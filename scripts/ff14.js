const puppeteer = require('puppeteer')
const fs = require('fs').promises
const Jimp = require('jimp')
const pixelmatch = require('pixelmatch')
const { cv } = require('opencv-wasm')
const sendNotify = require('./sendNotify')

async function findPuzzlePosition (page) {
    let images = await page.$$eval('.geetest_canvas_img canvas', canvases => canvases.map(canvas => canvas.toDataURL().replace(/^data:image\/png;base64,/, '')))

    await fs.writeFile(`./puzzle.png`, images[1], 'base64')

    let srcPuzzleImage = await Jimp.read('./puzzle.png')
    let srcPuzzle = cv.matFromImageData(srcPuzzleImage.bitmap)
    let dstPuzzle = new cv.Mat()

    cv.cvtColor(srcPuzzle, srcPuzzle, cv.COLOR_BGR2GRAY)
    cv.threshold(srcPuzzle, dstPuzzle, 127, 255, cv.THRESH_BINARY)

    let kernel = cv.Mat.ones(5, 5, cv.CV_8UC1)
    let anchor = new cv.Point(-1, -1)
    cv.dilate(dstPuzzle, dstPuzzle, kernel, anchor, 1)
    cv.erode(dstPuzzle, dstPuzzle, kernel, anchor, 1)

    let contours = new cv.MatVector()
    let hierarchy = new cv.Mat()
    cv.findContours(dstPuzzle, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    let contour = contours.get(0)
    let moment = cv.moments(contour)

    return [Math.floor(moment.m10 / moment.m00), Math.floor(moment.m01 / moment.m00)]
}

async function findDiffPosition (page) {
    await page.waitFor(100)

    let srcImage = await Jimp.read('./diff.png')
    let src = cv.matFromImageData(srcImage.bitmap)

    let dst = new cv.Mat()
    let kernel = cv.Mat.ones(5, 5, cv.CV_8UC1)
    let anchor = new cv.Point(-1, -1)

    cv.threshold(src, dst, 127, 255, cv.THRESH_BINARY)
    cv.erode(dst, dst, kernel, anchor, 1)
    cv.dilate(dst, dst, kernel, anchor, 1)
    cv.erode(dst, dst, kernel, anchor, 1)
    cv.dilate(dst, dst, kernel, anchor, 1)

    cv.cvtColor(dst, dst, cv.COLOR_BGR2GRAY)
    cv.threshold(dst, dst, 150, 255, cv.THRESH_BINARY_INV)

    let contours = new cv.MatVector()
    let hierarchy = new cv.Mat()
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    let contour = contours.get(0)
    let moment = cv.moments(contour)

    return [Math.floor(moment.m10 / moment.m00), Math.floor(moment.m01 / moment.m00)]
}

async function saveSliderCaptchaImages(page) {
    await page.waitForSelector('div.geetest_radar_tip')
    await page.waitFor(1000)

    await page.click('div.geetest_radar_tip')

    await page.waitForSelector('.geetest_canvas_img canvas', { visible: true })
    await page.waitFor(1000)
    let images = await page.$$eval('.geetest_canvas_img canvas', canvases => {
        return canvases.map(canvas => canvas.toDataURL().replace(/^data:image\/png;base64,/, ''))
    })

    await fs.writeFile(`./captcha.png`, images[0], 'base64')
    await fs.writeFile(`./original.png`, images[2], 'base64')
}

async function chooseRoleAndCheckin(page) {
    await page.waitForSelector('.el-input--suffix')
    let selector = await page.$$('.el-input--suffix')
    await selector[0].click()
    await page.waitForTimeout(1000)
    let server = await page.$$('.el-select-dropdown__item')
    const SERVER = process.env.SERVER
    if (SERVER === '陆行鸟') await server[0].click()
    else if (SERVER === '莫古力') await server[1].click()
    else if (SERVER === '猫小胖') await server[2].click()
    else console.log('大区名字错误，请修改secrets')
    await page.waitForTimeout(3000)
    await selector[1].click()
    await page.waitForTimeout(3000)
    let roles = await page.$$('.el-select-dropdown__item')
    const AREA = process.env.AREA
    const ROLE = process.env.ROLE
    for (let i = 0; i < roles.length; i++) {
        let innerText = await roles[i].$$eval('span', node => node.map(n => n.innerText))
        if (innerText[0].includes(AREA) && innerText[0].toLocaleLowerCase().includes(ROLE.toLocaleLowerCase())) {
            await roles[i].click()
            await page.waitForTimeout(3000)
            let btn = await page.$('.el-button--primary')
            btn.click()
            await page.waitForTimeout(3000)
            btn = await page.$('.eveBtn')
            btn.click()
            break
        }
    }
}

async function saveDiffImage() {
    const originalImage = await Jimp.read('./original.png')
    const captchaImage = await Jimp.read('./captcha.png')

    const { width, height } = originalImage.bitmap
    const diffImage = new Jimp(width, height)

    const diffOptions = { includeAA: true, threshold: 0.2 }

    pixelmatch(originalImage.bitmap.data, captchaImage.bitmap.data, diffImage.bitmap.data, width, height, diffOptions)
    diffImage.write('./diff.png')
}

const captcha = 2; 

async function run () {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 500, height: 750 }
    })
    const page = await browser.newPage()
    async function a1 () {
        await page.goto('https://actff1.web.sdo.com/20180707jifen/index.html#/home')
        await page.evaluate(() => {
            document.querySelector('div.signBtn').click()
        })
        await page.waitForSelector('#username')
        await page.waitForTimeout(2000)
        const USERNAME = process.env.USERNAME
        const PASSWORD = process.env.PASSWORD
        await page.type('#username', USERNAME)
        await page.type('#password', PASSWORD)
        while (await page.$('div.geetest_radar_tip') === null) {
            await page.evaluate(() => {
                document.querySelector('#btn_user_login').click()
            })
            await page.waitForTimeout(8000)
        }
        //for the sake of clarity, i just made a simple >0 eq. 
        if (captcha > 0) { 
            await page.waitForTimeout(3000)

            await saveSliderCaptchaImages(page)
            await saveDiffImage()

            let [cx, cy] = await findDiffPosition(page)

            const sliderHandle = await page.$('.geetest_slider_button')
            const handle = await sliderHandle.boundingBox()

            let xPosition = handle.x + handle.width / 2
            let yPosition = handle.y + handle.height / 2
            await page.mouse.move(xPosition, yPosition)
            await page.mouse.down()

            xPosition = handle.x + cx - handle.width / 2
            yPosition = handle.y + handle.height / 3
            await page.mouse.move(xPosition, yPosition, { steps: 25 })

            await page.waitForTimeout(100)

            let [cxPuzzle, cyPuzzle] = await findPuzzlePosition(page)

            xPosition = xPosition + cx - cxPuzzle
            yPosition = handle.y + handle.height / 2
            await page.mouse.move(xPosition, yPosition, { steps: 3 })
            await page.mouse.up()

            await page.waitForTimeout(3000)
            // success!
    
            await fs.unlink('./original.png')
            await fs.unlink('./captcha.png')
            await fs.unlink('./diff.png')
            await fs.unlink('./puzzle.png')

            // this is the part where you would put shit that would remove the captcha solved from queue
            // im really not sure how to do that frontend wise without fucking up the multi-solver support part
            // but have fun figuring that out
            //
            // i guess you can just do math and have captcha -1, but then again, that would fuck up if you have two solvers solve at once
            // and a catch for errors should be needed in case the link is nullified
            // but i handle that on backend so uh good luck
            await page.waitForTimeout(8000)
            while (await page.$('div.geetest_radar_tip') !== null) {
                await page.reload();
                await a1();
                await page.waitForTimeout(1000)
            }
            console.log('登陆成功')
            await chooseRoleAndCheckin(page)
            await page.waitForSelector('.el-notification__content')
            const notify = await page.$('.el-notification__content')
            const notice = await notify.$$eval('p', node => node.map(n => n.innerText))
            const score = await page.$('.fenbox')
            const curScore = await score.$$eval('p', node => node.map(n => n.innerText))
            // console.log(notice[0])
            sendNotify(notice[0], curScore[0])
            page.close()
        }
    }
a1()
}
run()