var hexdump = require('hexdump-nodejs');

//var global_key = [0x55, 0x72, 0x6B, 0x23, 0x6E, 0x49, 0x37, 0x6E, 0x69];

var keep_alive = [0x63, 0x65, 0x31, 0x64, 0x78, 0x76, 0xf6, 0xb5, 0x3f, 0x62, 0x64, 0x30, 0x65, 0xae, 0x0f, 0x9a, 0x64, 0x4b];
var tail = [0x8a, 0xb3, 0x21];

var short_arg = 0x02EB;
var byte_arg = 0x96;

var name_key = 'c9eb2ce697e504f9f89cd8524afccd1f8ba0b99ec2ada60583de964bc701e9570cc79d555d0d19db4720c439bce80e88ecac251e5a06e4a7c60a2087fe46b91bfffac7fb662e8fbf1421bd015d723d8edf53d6eef09b16bf1921ca14c3770f43b02a9f5ccc421a7aee36189cffa29579fb4598efda2ddb073ebce67c06588ed49c66b3394b90f4d7e3a13b02d01e17cd52166cbca6bc69ca8302862614dbd976561572fe45d07edc45f3e643205e1c6e45a6ad3198e583db3e5f93b6b0edf675fcd9460587fbfb70cdf632f47dcc8443da65a064af479c0ca78e1178240ba206ee15b80de0dde1420c06564e2bbe41bd2c9ba1ad4055a486bffe2fe53e031455ffc70008fc4a881d2bbdac5e48babd4a49ff04938bb2b97bba20ede10df68f8e97b522307218089a1c0089f7060242c22573f0b4d5a9df7732b48624a1fc3658abd60e45da69bdaa1945f963ead91a3cce599af6fdcd5b3241b74fceddba6a960fdbf752f628bb6050b8c000b37059362247d1ba52bd04e42179cc1a45371f5d434a9d2a30c4a3e5af4bb4ce7531501eb7797c092ed36f8322ec90fdc5f918db7daeec6236489540dec881e20a8512bc71e1e27e0b36afdecb273808d09a953ec05ccf8f4ad3cd963382f0b3c6a874870226099307a4cebfffa9eae3ba992fb3e8d93d19ebe4fa970798156d3e4c379642bcc57343d0fe9dda92c0c23d61e2eb';

var temp_key = '';
function generate_temp_key(short_arg, byte_arg)
{
	var ecx = byte_arg * byte_arg;
	var ebx;

	temp_key = '';
	for (var i = 0; i < 9; ++i)
	{
		ebx = ((ecx * i) + short_arg) & 0x800003FF;
		temp_key += String.fromCharCode(name_key.charCodeAt(ebx));
		ecx += 3;
	}
}

generate_temp_key(short_arg, byte_arg);
console.log(temp_key);

function crypt_packet(key, inc, data)
{
	for (var i = 0; i < data.length - 3; ++i)
	{
		data[i] = data[i] ^ key[i % 9];
		var group = Math.floor(i / 9);
		if (group != inc)
			data[i] = data[i] ^ group;

		data[i] = data[i] ^ inc;
	}
}

crypt_packet(temp_key, 0x07, keep_alive);
console.log(hexdump(new Buffer(keep_alive)));