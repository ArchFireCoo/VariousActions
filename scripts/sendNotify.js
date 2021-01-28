const axios = require('axios')

const SCKEY = process.env.SCKEY

const sendNotify = (title, message) => {
  if (SCKEY) {
    axios
      .get(`https://sc.ftqq.com/${SCKEY}.sendNotify`, {
        params: {
          text: title,
          desp: message,
        },
      })
      .then(({ data }) => {
        if (data.errno === 0) {
          console.log('server酱发送通知消息成功\n')
        } else if (data.errno === 1024) {
          console.log(`server酱发送通知消息异常: ${data.errmsg}\n`)
        } else {
          console.log(`server酱发送通知消息异常\n${JSON.stringify(data)}`)
        }
      })
      .catch((err) => {
        console.log('发送通知调用API失败！！\n')
        console.log(err)
      })
  } else {
    console.log('您未提供server酱的SCKEY，取消微信推送消息通知\n')
  }
}

module.exports = sendNotify
