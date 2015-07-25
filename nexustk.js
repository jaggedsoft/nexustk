var Promise = require('promise');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var hexdump = require('hexdump-nodejs');
var crypto = require('crypto');

var client_states = {
	DISCONNECTED: 0,
	CONNECTED: 1,
	CONNECTED_SERVER: 2,
	BARAM: 3,
	VERSION: 4,
	VERSION_RESPONSE: 5,
	NEW_CHARACTER: 6,
	NEW_CHARACTER_RESPONSE: 7,
	CHARACTER_DATA: 8,
	CHARACTER_DATA_RESPONSE: 9,
	LOGIN: 10,
	LOGIN_RESPONSE: 11,
	SERVER_CHANGE: 12,
	CLIENT_INTRODUCTION: 13,
	MAIN_LOOP: 14
};

var LOGIN_HOST = 'tk0.kru.com';
var LOGIN_PORT = 2000;

var global_key = 'Urk#nI7ni';
var temp_key = '';
var outbound_inc = 0x00;

var client_version = 0x02C5;

var username = 'sLyzYfWAeQ';
var username_key = generate_username_key();
var password = 'aaa1';
var login_id = null;
var dummy_key_len = null;
var dummy_key = null;

var connection = null;

var client_state = client_states.DISCONNECTED;

var event_emitter = new EventEmitter();
event_emitter.on('state_change', function () {
	console.log('state is', client_state);

	if (client_state == client_states.DISCONNECTED)
		connect_to_server(LOGIN_HOST, LOGIN_PORT);

	else if (client_state == client_states.CONNECTED_SERVER)
	{
		send_baram();
		send_version();
		change_state(client_states.VERSION);
	}

	else if (client_state == client_states.VERSION_RESPONSE)
	{
		/*new_character();
		change_state(client_states.NEW_CHARACTER);*/
		login();
		change_state(client_states.LOGIN);
	}

	else if (client_state == client_states.NEW_CHARACTER_RESPONSE)
	{
		character_data();
		change_state(client_states.CHARACTER_DATA);
	}

	else if (client_state == client_states.CHARACTER_DATA_RESPONSE)
	{
		login();
		change_state(client_states.LOGIN);
	}

	else if (client_state == client_states.CLIENT_INTRODUCTION)
	{
		client_introduction();
		change_state(client_states.MAIN_LOOP);
	}
})

var seed = 0x0029E2C0;
function nexustk_rand()
{
	seed = (seed * 0x343FD) + 0x269EC3;
	return (seed >> 0x10) & 0x7FFF;
}

function generate_username_key()
{
	var username_sum = crypto.createHash('md5').update(username).digest('hex');
	var buf = crypto.createHash('md5').update(username_sum).digest('hex');
	for (var i = 0; i < 31; ++i)
		buf += crypto.createHash('md5').update(buf).digest('hex');
	return buf;
}

function generate_temp_key(short_arg, byte_arg)
{
	var ecx = byte_arg * byte_arg;
	var ebx;

	temp_key = '';
	for (var i = 0; i < 9; ++i)
	{
		ebx = ((ecx * i) + short_arg) & 0x800003FF;
		temp_key += String.fromCharCode(username_key.charCodeAt(ebx));
		ecx += 3;
	}
}

function change_state(new_state)
{
	client_state = new_state;
	event_emitter.emit('state_change')	
}

function send_baram()
{
	var payload = [0x61, 0x72, 0x61, 0x6D, 0x00];
	crypt_packet(global_key, outbound_inc, payload);

	var tail = gen_packet_tail();

	var packet_length = payload.length + 5;
	var packet = new Buffer(payload.length + 8);
	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;
	packet[3] = 0x62;
	packet[4] = outbound_inc;

	for (var i = 0; i < payload.length; ++i)
		packet[5 + i] = payload[i];

	packet[5 + payload.length] = tail[0];
	packet[6 + payload.length] = tail[1];
	packet[7 + payload.length] = tail[2];

	connection.write(packet, 'binary');
	outbound_inc += 1;
}

function send_version()
{
	var payload = [0x00, client_version >> 8, client_version & 0xFF, 0xC5, 0x00, 0x00, 0x01, 0x00];

	var packet_length = payload.length;
	var packet = new Buffer(payload.length + 3);

	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;

	for (var i = 0; i < payload.length; ++i)
		packet[3 + i] = payload[i];

	connection.write(packet, 'binary');
}

function generate_random_string(length)
{
	var str = '';
	var possible_characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

	for (var i = 0; i < length; ++i)
		str += possible_characters.charAt(Math.floor(Math.random() * possible_characters.length));

	return str;
}

function new_character()
{
	var username = generate_random_string(10);
	console.log(username);
	var password = 'aaa1';

	var payload = [];
	payload.push(username.length);
	for (var i = 0; i < username.length; ++i)
		payload.push(username.charCodeAt(i));
	payload.push(password.length);
	for (var i = 0; i < password.length; ++i)
		payload.push(password.charCodeAt(i));

	payload.push(0x00);
	payload.push(0x00);
	payload.push(0x00);
	payload.push(0xCF);
	payload.push(0xD2);
	payload.push(0x50);

	crypt_packet(global_key, outbound_inc, payload);

	var tail = gen_packet_tail();

	var packet_length = payload.length + 5;
	var packet = new Buffer(payload.length + 8);
	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;
	packet[3] = 0x02;
	packet[4] = outbound_inc;

	for (var i = 0; i < payload.length; ++i)
		packet[5 + i] = payload[i];

	packet[5 + payload.length] = tail[0];
	packet[6 + payload.length] = tail[1];
	packet[7 + payload.length] = tail[2];

	connection.write(packet, 'binary');
	outbound_inc += 1;
}

function character_data()
{
	var payload = [0x00, 0xCC, 0x1F, 0x07, 0x07, 0x01, 0x00, 0x03, 0x00, 0x00, 0xF1, 0xC4, 0x43];

	crypt_packet(global_key, outbound_inc, payload);

	var tail = gen_packet_tail();

	var packet_length = payload.length + 5;
	var packet = new Buffer(payload.length + 8);
	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;
	packet[3] = 0x04;
	packet[4] = outbound_inc;

	for (var i = 0; i < payload.length; ++i)
		packet[5 + i] = payload[i];

	packet[5 + payload.length] = tail[0];
	packet[6 + payload.length] = tail[1];
	packet[7 + payload.length] = tail[2];

	connection.write(packet, 'binary');
	outbound_inc += 1;
}

function login()
{
	var payload = [];
	payload.push(username.length);
	for (var i = 0; i < username.length; ++i)
		payload.push(username.charCodeAt(i));
	payload.push(password.length);
	for (var i = 0; i < password.length; ++i)
		payload.push(password.charCodeAt(i));

	payload.push(0xF3);
	payload.push(0x1C);
	payload.push(0x27);
	payload.push(0x56);
	payload.push(0x00);
	payload.push(0x0D);
	payload.push(0x49);
	payload.push(0x1D);

	crypt_packet(global_key, outbound_inc, payload);

	var tail = gen_packet_tail();

	var packet_length = payload.length + 5;
	var packet = new Buffer(payload.length + 8);
	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;
	packet[3] = 0x03;
	packet[4] = outbound_inc;

	for (var i = 0; i < payload.length; ++i)
		packet[5 + i] = payload[i];

	packet[5 + payload.length] = tail[0];
	packet[6 + payload.length] = tail[1];
	packet[7 + payload.length] = tail[2];

	connection.write(packet, 'binary');
	outbound_inc += 1;
}

function convert_ip(ip)
{
	var parts = [];
	parts[0] = ip >> 24;
	parts[1] = (ip >> 16) & 0xFF;
	parts[2] = (ip >> 8) & 0xFF;
	parts[3] = ip & 0xFF;

	return parts.join('.');
}

function handle_server_change(data)
{
	var ip = convert_ip(data.readUInt32LE(0));
	var port = data.readUInt16BE(4);

	dummy_key_len = data.readUInt16BE(7);
	dummy_key = new Buffer(dummy_key_len);
	for (var i = 0; i < dummy_key_len; ++i)
		dummy_key[i] = data[9 + i];

	login_id = data.readUInt32BE(10 + dummy_key_len + username.length);

	connect_to_server(ip, port);
	outbound_inc = 0x00;
}

function client_introduction()
{
	var payload = [];
	payload.push(0x10);

	payload.push(dummy_key_len >> 8);
	payload.push(dummy_key_len & 0xFF);

	for (var i = 0; i < dummy_key_len; ++i)
		payload.push(dummy_key[i]);

	payload.push(username.length);

	for (var i = 0; i < username.length; ++i)
		payload.push(username.charCodeAt(i));

	payload.push(login_id >> 24);
	payload.push((login_id >> 16) & 0xFF);
	payload.push((login_id >> 8) & 0xFF);
	payload.push(login_id & 0xFF);

	payload.push(0x01);
	payload.push(0x00);

	var packet_length = payload.length;
	var packet = new Buffer(payload.length + 3);

	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;

	for (var i = 0; i < payload.length; ++i)
		packet[3 + i] = payload[i];

	connection.write(packet, 'binary');
}

function crypt_packet(key, inc, data)
{
	for (var i = 0; i < data.length - 3; ++i)
	{
		var c = key.charCodeAt(i % 9);

		data[i] = data[i] ^ c;
		var group = Math.floor(i / 9);
		if (group != inc)
			data[i] = data[i] ^ group;

		data[i] = data[i] ^ inc;
	}
}

function gen_packet_tail(temp_key)
{
	var tail = new Buffer(3);

	var short_arg = (nexustk_rand() % 0xFEFD) + 0x100;
	var byte_arg = (nexustk_rand() % 0x9B) + 0x64;

	if (temp_key != undefined)
		generate_temp_key(byte_arg, short_arg);

	tail[0] = (short_arg & 0x800000FF) ^ 0x61;
	tail[1] = (byte_arg & 0x800000FF) ^ 0x25;
	tail[2] = ((short_arg >> 8) & 0x800000FF) ^ 0x23;

	return tail;
}

function handle_incoming_packet_crypt(id, inc, buf)
{
	var len = buf.length;

	if (id == 0x00 || id == 0x03 || id == 0x40 || id == 0x7E)
	{
		return;
	}

	else if (id == 0x02 || id == 0x0A || id == 0x44 || id == 0x5E || id == 0x60 || id == 0x62 || id == 0x66 || id == 0x6F)
	{
		crypt_packet(global_key, inc, buf);
		buf.slice(0, len - 3);
	}

	else
	{
		var byte_arg = ((buf[len - 1] ^ 0x74) << 8) + (buf[len - 3] ^ 0x24);
		var short_arg = buf[len - 2] ^ 0x21;
		generate_temp_key(byte_arg, short_arg);
		crypt_packet(temp_key, inc, buf);
		buf.slice(0, len - 3);
	}
}

function handle_keep_alive_45(data)
{
	//console.log(hexdump(data));
}

function handle_keep_alive_75(data)
{
	var bait_1 = [data[0], data[1], data[2], data[3]];
	var bait_2 = [data[4], data[5], data[6], data[7]];
	var padding = [0, 0, 0, 0];
	var uptime = [0x01, 0xb4, 0x8d, 0xe0];

	var payload = [];
	for (var i = 0; i < bait_1.length; ++i)
		payload.push(bait_1[i]);
	for (var i = 0; i < bait_2.length; ++i)
		payload.push(bait_2[i]);
	for (var i = 0; i < padding.length; ++i)
		payload.push(padding[i]);
	for (var i = 0; i < uptime.length; ++i)
		payload.push(uptime[i]);
	payload.push(0x00);
	payload.push(0x75);

	var tmp = new Buffer(payload);
	console.log(hexdump(tmp));

	var tail = gen_packet_tail(true);
	crypt_packet(temp_key, outbound_inc, payload);

	var packet_length = payload.length + 5;
	var packet = new Buffer(payload.length + 8);
	packet[0] = 0xAA;
	packet[1] = packet_length >> 8;
	packet[2] = packet_length & 0xFF;
	packet[3] = 0x75;
	packet[4] = outbound_inc;

	for (var i = 0; i < payload.length; ++i)
		packet[5 + i] = payload[i];

	packet[5 + payload.length] = tail[0];
	packet[6 + payload.length] = tail[1];
	packet[7 + payload.length] = tail[2];

	connection.write(packet, 'binary');
	outbound_inc += 1;

	console.log(hexdump(packet));
}

function handle_incoming_packet(id, data)
{
	console.log('id', id.toString(16), 'data length', data.length);

	var inc = data.readUInt8(0);
	var buf = data.slice(1);

	handle_incoming_packet_crypt(id, inc, buf);

	if (id == 0x7E)
		change_state(client_states.CONNECTED_SERVER);

	else if (id == 0x02)
	{
		if (client_state == client_states.NEW_CHARACTER)
		{
			if (data[1] == 0x04)
				console.log('bad username');
			else if (data[1] != 0x00)
				console.log('unknown response 1', hexdump(data));
			else
				change_state(client_states.NEW_CHARACTER_RESPONSE);
		}

		else if (client_state == client_states.CHARACTER_DATA)
		{
			if (data[0] != 0x01)
				console.log('unknown response 2', hexdump(data));
			else
				change_state(client_states.CHARACTER_DATA_RESPONSE);
		}

		else if (client_state == client_states.LOGIN)
		{
			if (data[1] != 0x00)
				console.log('login falied');
			else
				change_state(client_states.SERVER_CHANGE);
		}

		else
			console.log(hexdump(data));
	}

	else if (id == 0x00)
	{
		if (client_state == client_states.VERSION)
		{
			if (data[0] == 0x00)
				change_state(client_states.VERSION_RESPONSE);
			else
				console.log('bad version');
		}
	}

	else if (id == 0x03)
	{
		if (client_state == client_states.SERVER_CHANGE)
			handle_server_change(data);
	}

	else if (id == 0x3B)
	{
		handle_keep_alive_45(buf);
	}

	else if (id == 0x68)
	{
		handle_keep_alive_75(buf);
	}
}

function parse_packet(buf)
{
	var delimiter = buf.readUInt8(0);
	var length = buf.readUInt16BE(1);
	var id = buf.readUInt8(3);
	var data = buf.slice(4);

	assert(delimiter == 0xAA);
	assert(buf.length >= length + 3);

	handle_incoming_packet(id, data);
}

function connect_to_server(host, port)
{
	connection = net.connect(port, host);

	connection.on('connect', function () {
		if (client_state == client_states.SERVER_CHANGE)
			change_state(client_states.CLIENT_INTRODUCTION);
		else
			change_state(client_states.CONNECTED);
	})

	connection.on('close', function () {
		if (client_state != client_states.SERVER_CHANGE)
			change_state(client_states.DISCONNECTED);
	})

	connection.on('error', function (err) {
		console.log('connection error', err)
	})

	connection.on('data', function (chunk) {
		var i = 0;
		while (i < chunk.length)
		{
			var length = chunk.readUInt16BE(i + 1);
			parse_packet(chunk.slice(i, i + length + 3));
			i += length + 3;
		}
	})
}

event_emitter.emit('state_change');