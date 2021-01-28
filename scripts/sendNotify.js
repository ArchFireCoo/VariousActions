const axios = require('axios')

const sendNotify = (title, message) => {
  axios.get(`https://sc.ftqq.com/${process.env.SCKEY}.sendNotify`, {
    params: {
      text: title,
      desp: message,
    },
  })
}

module.exports = sendNotify
