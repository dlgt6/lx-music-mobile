import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Text from '@/components/common/Text'
import { View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { bindUserApiUrl } from '@/core/userApiUpdate'

export interface ScriptUpdateUrlType {
  show: (info: LX.UserApi.UserApiInfo) => void
}

export default forwardRef<ScriptUpdateUrlType, {}>((props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const alertRef = useRef<ConfirmAlertType>(null)
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [target, setTarget] = useState<LX.UserApi.UserApiInfo | null>(null)
  const [url, setUrl] = useState('')
  const [btn, setBtn] = useState({ disabled: false, text: t('user_api_update_url_confirm') })

  const handleShow = (info: LX.UserApi.UserApiInfo) => {
    setTarget(info)
    setUrl(info.url ?? '')
    setBtn({ disabled: false, text: t('user_api_update_url_confirm') })
    alertRef.current?.setVisible(true)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 300)
  }
  useImperativeHandle(ref, () => ({
    show(info) {
      if (visible) handleShow(info)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow(info)
        })
      }
    },
  }))

  const handleConfirm = async() => {
    const newUrl = url.trim()
    if (!/^https?:\/\//.test(newUrl)) {
      toast(t('user_api_url_invalid_tip'))
      return
    }
    if (!target || btn.disabled) return
    setBtn({ disabled: true, text: t('user_api_update_url_loading') })
    try {
      await bindUserApiUrl(target.id, newUrl)
      alertRef.current?.setVisible(false)
    } catch (err) {
      toast(t('user_api_update_failed_tip', { name: target.name, message: err instanceof Error ? err.message : String(err) }), 'long')
    } finally {
      setBtn({ disabled: false, text: t('user_api_update_url_confirm') })
    }
  }

  return (
    visible
      ? <ConfirmAlert
          ref={alertRef}
          title={t('user_api_update_url_title')}
          onConfirm={handleConfirm}
          disabledConfirm={btn.disabled}
          confirmText={btn.text}
        >
          <View style={styles.content}>
            <Text size={12} style={styles.tip}>{ t('user_api_update_url_desc', { name: target?.name ?? '' }) }</Text>
            <Input
              ref={inputRef}
              placeholder={t('user_api_btn_import_online_input_tip')}
              value={url}
              onChangeText={setUrl}
              style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
            />
          </View>
        </ConfirmAlert>
      : null
  )
})

const styles = createStyle({
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  tip: {
    marginBottom: 8,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 290,
    borderRadius: 4,
  },
})
