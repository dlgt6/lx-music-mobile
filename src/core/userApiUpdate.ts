import { AppState } from 'react-native'
import { toMD5, toast } from '@/utils/tools'
import { httpFetch } from '@/utils/request'
import { getUserApiList, getUserApiScript, setUserApiUpdateTime, updateUserApiScript } from '@/utils/data'
import { setUserApiList } from '@/core/userApi'
import { setApiSource } from '@/core/apiSource'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'

/** 自动检查更新的最小间隔（毫秒），手动检查不受限制 */
const AUTO_UPDATE_INTERVAL = 30 * 60 * 1000
const MAX_SCRIPT_SIZE = 9_000_000
const SCRIPT_HEADER_RXP = /^\/\*[\S|\s]+?\*\//

interface FetchResponse {
  statusCode?: number
  body: unknown
}

export interface CheckUserApiUpdateOptions {
  /** 只检查指定的源 */
  ids?: string[]
  /** 忽略检查间隔（手动检查） */
  force?: boolean
  /** 手动检查时显示逐项结果提示 */
  manual?: boolean
}

export interface CheckUserApiUpdateResult {
  checked: number
  updated: number
  failed: number
}

let lastCheckTime = 0
let isRegistered = false

/**
 * 所有会写自定义源数据的操作都串行执行。
 * data.ts 维护了模块级列表缓存，并发调用会用各自读到的旧列表互相覆盖写结果。
 */
let taskQueue: Promise<unknown> = Promise.resolve()
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const result = taskQueue.then(task)
  taskQueue = result.catch(() => undefined)
  return result
}

const getErrorMessage = (err: unknown): string => err instanceof Error ? err.message : String(err)

/**
 * 拉取并校验在线自定义源脚本（洛雪在线源为 js 文本，头部带块注释）
 */
export const fetchUserApiScript = async(url: string): Promise<string> => {
  const resp = (await httpFetch(url).promise) as FetchResponse
  if ((resp.statusCode ?? 200) >= 400) throw new Error(`HTTP ${resp.statusCode ?? 0}`)
  const body = resp.body
  if (typeof body != 'string' || !body.length) throw new Error(global.i18n.t('user_api_add_failed_tip'))
  // 部分源带 BOM 或开头空行，去掉后才能正确匹配头部信息注释
  const script = body.replace(/^\uFEFF/, '').replace(/^\s+/, '')
  if (!script.length) throw new Error(global.i18n.t('user_api_add_failed_tip'))
  if (script.length > MAX_SCRIPT_SIZE) throw new Error('Too large script')
  if (!SCRIPT_HEADER_RXP.test(script)) throw new Error(global.i18n.t('user_api_add_failed_tip'))
  return script
}

const syncUserApiList = async() => {
  setUserApiList(await getUserApiList())
}

/**
 * 若更新的是当前正在使用的源，重新载入脚本让改动立即生效
 */
export const reloadActiveUserApi = (id: string) => {
  if (settingState.setting['common.apiSource'] != id) return
  setApiSource(id)
}

const isScriptChanged = async(api: LX.UserApi.UserApiInfo, script: string) => {
  // 旧版本导入的源没有指纹，回退到直接比对脚本内容
  return api.scriptHash ? api.scriptHash != toMD5(script) : (await getUserApiScript(api.id)) != script
}

const runCheck = async(options: CheckUserApiUpdateOptions): Promise<CheckUserApiUpdateResult> => {
  const result: CheckUserApiUpdateResult = { checked: 0, updated: 0, failed: 0 }
  const now = Date.now()
  // 节流判断放在队列任务内，排队期间若已有检查完成会直接跳过
  if (!options.force && now - lastCheckTime < AUTO_UPDATE_INTERVAL) return result
  // 全量检查开始时即记录，避免冷启动/回前台/定时器/打开页面等多个触发点重复检查
  if (options.ids == null) lastCheckTime = now

  try {
    const list = await getUserApiList()
    // 显式指定 id 的手动刷新不受「自动检查更新」开关限制
    const targets = list.filter(api => api.url &&
      (options.ids != null || api.autoUpdate !== false) &&
      (!options.ids || options.ids.includes(api.id)))
    if (!targets.length) return result

    const checkedIds: string[] = []
    const updatedIds: string[] = []
    for (const api of targets) {
      try {
        const script = await fetchUserApiScript(api.url!)
        checkedIds.push(api.id)
        result.checked++
        if (!await isScriptChanged(api, script)) {
          if (options.manual && options.ids) toast(global.i18n.t('user_api_update_latest_tip'))
          continue
        }
        const info = await updateUserApiScript(api.id, script)
        updatedIds.push(api.id)
        result.updated++
        if (options.manual) toast(global.i18n.t('user_api_update_success_tip', { name: info.name }))
      } catch (err) {
        result.failed++
        const message = getErrorMessage(err)
        log.warn('[user api auto update]', message)
        if (options.manual) toast(global.i18n.t('user_api_update_failed_tip', { name: api.name, message }), 'long')
      }
    }

    await setUserApiUpdateTime(checkedIds)
    await syncUserApiList()
    for (const id of updatedIds) reloadActiveUserApi(id)

    if (options.manual && !options.ids && !result.updated && !result.failed) {
      toast(global.i18n.t('user_api_update_latest_tip'))
    } else if (!options.manual && result.updated) {
      toast(global.i18n.t('user_api_auto_updated_tip', { num: result.updated }))
    }
  } catch (err) {
    // 读写存储失败时也不让调用方收到未处理的 Promise 异常
    log.warn('[user api auto update]', getErrorMessage(err))
  }
  return result
}

/**
 * 检查在线自定义源更新。
 * App 启动、回到前台、打开自定义源管理、定时轮询会自动调用（受间隔限制），也可由界面手动强制调用。
 */
export const checkUserApiUpdate = (options: CheckUserApiUpdateOptions = {}) => enqueue(() => runCheck(options))

/** 手动刷新单个源 */
export const refreshUserApi = (id: string) => checkUserApiUpdate({ ids: [id], force: true, manual: true })

/** 手动刷新全部在线源 */
export const refreshAllUserApi = () => checkUserApiUpdate({ force: true, manual: true })

/**
 * 为本地导入（或旧版本导入）的源绑定/修改在线地址，并立即同步远程脚本
 */
export const bindUserApiUrl = (id: string, url: string): Promise<void> => enqueue(async() => {
  const script = await fetchUserApiScript(url)
  const info = (await getUserApiList()).find(api => api.id === id)
  if (!info) throw new Error('api not found')
  const changed = await isScriptChanged(info, script)
  // 内容相同也重写一次，补齐 scriptHash、头部元数据、更新地址与检查时间
  const newInfo = await updateUserApiScript(id, script, url)
  await syncUserApiList()
  if (changed) {
    reloadActiveUserApi(id)
    toast(global.i18n.t('user_api_update_success_tip', { name: newInfo.name }))
  } else {
    toast(global.i18n.t('user_api_update_latest_tip'))
  }
})

/**
 * 注册自动更新时机：冷启动、回到前台、打开自定义源管理、定时轮询（均受最小间隔限制）
 */
export const initUserApiAutoUpdate = () => {
  if (isRegistered) return
  isRegistered = true
  AppState.addEventListener('change', state => {
    if (state == 'active') void checkUserApiUpdate()
  })
  setInterval(() => {
    if (AppState.currentState == 'active') void checkUserApiUpdate()
  }, AUTO_UPDATE_INTERVAL)
  void checkUserApiUpdate()
}
