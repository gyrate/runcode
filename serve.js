// 加载必须的模块
const http = require('http')
const fs = require('fs')
const url = require('url')
const path = require('path')
const mime = require('./mime.json')  //各种文件的后缀映射关系json


// 定位静态目录的位置，根据请求找出对应的文件
function staticRoot (staticPath, req, res) {
  const pathObj = url.parse(req.url, true)

  if (pathObj.pathname === '/') {
    pathObj.pathname += 'index.html'
  }
  // 读取静态目录里面的文件，然后发送出去
  const filePath = path.join(staticPath, pathObj.pathname)
  fs.readFile(filePath, 'binary', function (err, content) {
    if (err) {
      res.writeHead(404, 'Not Found')
      res.end('<h1>404 Not Found</h1>')
    } else {
      // res.setHead('Access-Control-Allow-Private-Network', 'true')

      let dtype = 'text/html';
      //获取请求文件的后缀
      let ext = path.extname(req.url).replace('.','');
      if (mime[ext]) {
        dtype = mime[ext]
      }

      //如果响应的内容是文本，就设置utf8
      if(dtype.startsWith('text')){
        dtype += '; charset=utf-8'
      }

      res.writeHead(200,{'Content-Type': dtype});
      res.write(content, 'binary')
      res.end()
    }
  })
}

// 创建服务器
const server = http.createServer(function (req, res) {
  staticRoot(path.join(__dirname, ''), req, res)
})

// 监听8080端口
server.listen(8888)
console.log('http://localhost:8888')
