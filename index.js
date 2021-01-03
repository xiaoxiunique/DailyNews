const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const nodemailer = require('nodemailer');
const moment = require('moment');

const [user, pass, tomail] = process.argv.slice(2);
console.log('user, pass, tomail: ', user, pass, tomail);

/**
 * 根据请求配置 读取数据
 */
async function handleReqConf({ method, url, header, data = {}, contentField }) {
  const axios = require('axios');
  const config = {
    method,
    url,
    headers: header,
    data,
  };

  const result = await axios(config);
  return _.get(result, contentField, []);
}

function readReqFlow() {
  const filePath = path.resolve(__dirname, './src/reqConf.json');
  const reqJsonSTR = fs.readFileSync(filePath, {
    encoding: 'utf-8',
  });
  return JSON.parse(reqJsonSTR).requestConfList;
}

function writeData2MD(itemList, { parse, title }) {
  const daySTR = moment().format('yyyy-MM-DD');
  const exists = fs.existsSync(
    path.resolve(__dirname, './data/', './' + daySTR)
  );
  if (!exists) {
    fs.mkdirSync(path.resolve(__dirname, './data/', './' + daySTR));
  }

  const STR = itemList.reduce((acc, item) => {
    const title = _.get(item, parse.title);
    const jumpURL = (parse.baseURL || '') + _.get(item, parse.jumpURL);

    return acc + `\n- [${title}](${jumpURL})`;
  }, `## ${title} \n`);

  fs.writeFileSync(
    path.resolve(__dirname, `./data/${daySTR}/` + title + '.md'),
    STR
  );
}

async function transferMD2Html() {
  const daySTR = moment().format('yyyy-MM-DD');
  const fileList = fs.readdirSync(path.resolve(__dirname, './data/' + daySTR));

  let htmlSTR = '';
  for (const file of fileList) {
    const mdSTR = fs.readFileSync(path.resolve(__dirname, './data/' + file), {
      encoding: 'utf8',
    });

    const md = require('markdown').markdown;
    const mdHTML = md.toHTML(mdSTR);
    htmlSTR += mdHTML + '\n';
  }

  await sendMail(tomail, htmlSTR);
  fs.writeFileSync(path.resolve(__dirname, './schedule-news.html'), htmlSTR);
}

async function sendMail(tomail = 'xiaoxiunique@qq.com', HTML) {
  // Create a SMTP transporter object
  let transporter = nodemailer.createTransport({
    secure: true,
    host: 'smtp.163.com',
    auth: {
      user: user,
      //这里是授权密码而不是邮件密码
      pass: pass,
    },
  });
  // Message object
  let message = {
    from: user,

    // Comma separated list of recipients
    to: tomail,
    // Subject of the message
    subject: '每日新闻',
    text: 'test',

    // HTML body
    html: HTML,
  };

  let info = await transporter.sendMail(message);
  console.log('Message sent successfully as %s', info.messageId);
}

(async function () {
  const reqFlow = readReqFlow();

  for (const reqConf of [...reqFlow]) {
    try {
      const result = await handleReqConf(reqConf);
      writeData2MD(result, reqConf);
    } catch (e) {
      console.error('读取失败', e.message);
    }
  }

  await transferMD2Html();
})();
