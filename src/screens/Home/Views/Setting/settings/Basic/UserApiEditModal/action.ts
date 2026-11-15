import { importUserApi } from '@/core/userApi'
import { reloadActiveUserApi } from '@/core/userApiUpdate'
import { readFile } from '@/utils/fs'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'


export const handleImportScript = async(script: string, url?: string) => {
  await importUserApi(script, url).then(info => {
    // 重复导入同一地址会覆盖已有源，若它正在使用需要重新载入脚本
    reloadActiveUserApi(info.id)
    toast(global.i18n.t('user_api_import_success_tip'))
  }).catch(error => {
    log.error(error instanceof Error ? error.stack : String(error))
    toast(global.i18n.t('user_api_import_failed_tip', { message: error instanceof Error ? error.message : String(error) }), 'long')
  })
}

export const handleImportLocalFile = (path: string) => {
  // toast(global.i18n.t('setting_backup_part_import_list_tip_unzip'))
  void readFile(path).then(async script => {
    if (script == null) throw new Error('Read file failed')
    void handleImportScript(script)
  }).catch(error => {
    toast(global.i18n.t('user_api_import_failed_tip', { message: error instanceof Error ? error.message : String(error) }), 'long')
  })
}

