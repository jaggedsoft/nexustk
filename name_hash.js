var crypto = require('crypto');

var username = 'MuffinFlavor';

function generate_name_key()
{
	var username_sum = crypto.createHash('md5').update(username).digest('hex');
	var buf = crypto.createHash('md5').update(username_sum).digest('hex');
	for (var i = 0; i < 31; ++i)
		buf += crypto.createHash('md5').update(buf).digest('hex');
	return buf;
}

console.log(generate_name_key());