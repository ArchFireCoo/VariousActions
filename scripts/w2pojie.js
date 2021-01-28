const axios = require('axios')
const sendNotify = require('./sendNotify')

const main = async () => {
  try {
    const response = await axios.get('https://www.52pojie.cn/home.php?mod=task&do=apply&id=2', {
      headers: {
        cookie: process.env.COOKIE,
      },
      responseType: 'arraybuffer',
    })
    const data = require('iconv-lite').decode(response.data, 'gb2312')
    let result = null

    if (data.match(/您需要先登录才能继续本操作/)) {
      result = '⚠️⚠️签到失败,cookie失效⚠️⚠️'
    } else if (data.match(/已申请过此任务/)) {
      result = '今日已签☑️'
    } else if (data.match(/恭喜/)) {
      result = '签到成功✅'
    } else {
      result = '签到失败,原因未知❗️'
    }

    console.log(result)
    sendNotify('w2pojie', result)
  } catch (error) {
    console.log(error)
  }
}

main()
