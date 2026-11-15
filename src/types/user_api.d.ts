declare namespace LX {
  namespace UserApi {
    type UserApiSourceInfoType = 'music'
    type UserApiSourceInfoActions = 'musicUrl' | 'lyric' | 'pic'

    interface UserApiSourceInfo {
      name: string
      type: UserApiSourceInfoType
      actions: UserApiSourceInfoActions[]
      qualitys: LX.Quality[]
    }

    type UserApiSources = Record<LX.Source, UserApiSourceInfo>


    interface UserApiInfo {
      id: string
      name: string
      description: string
      // script: string
      allowShowUpdateAlert: boolean
      author: string
      homepage: string
      version: string
      sources?: UserApiSources
      /** 在线导入时的脚本地址，本地导入的源没有此字段 */
      url?: string
      /** 是否自动检查远程更新，未设置时视为开启 */
      autoUpdate?: boolean
      /** 当前已保存脚本内容的 MD5，用于判断远程脚本是否变化 */
      scriptHash?: string
      /** 最近一次成功检查更新的时间戳 */
      updateTime?: number
    }

    interface UserApiStatus {
      status: boolean
      message?: string
      apiInfo?: UserApiInfo
    }

    interface UserApiUpdateInfo {
      name: string
      description: string
      log: string
      updateUrl?: string
    }

    interface UserApiRequestParams {
      requestKey: string
      data: any
    }
    interface UserApiRequestParams {
      requestKey: string
      data: any
    }
    type UserApiRequestCancelParams = string
    type UserApiSetApiParams = string

    interface UserApiSetAllowUpdateAlertParams {
      id: string
      enable: boolean
    }

    interface ImportUserApi {
      apiInfo: UserApiInfo
      apiList: UserApiInfo[]
    }

  }
}
