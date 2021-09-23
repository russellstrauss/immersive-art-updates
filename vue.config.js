const fs = require('fs');

// https configuration, create key and cert using mkcert https://stackoverflow.com/questions/45807049/how-to-run-vue-js-dev-serve-with-https/57226788#57226788

module.exports = {
	devServer: {
		https: true,
		key: fs.readFileSync('./src/assets/ssh/jrstrauss.net+5-key.pem'),
		cert: fs.readFileSync('./src/assets/ssh/jrstrauss.net+5.pem')
	}
}