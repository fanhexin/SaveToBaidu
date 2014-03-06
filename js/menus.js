(function() {
	var BAIDUYUN_URL = "http://yun.baidu.com/";
	var BAIDUPAN_SAVE_URL = "http://pan.baidu.com/rest/2.0/services/cloud_dl?channel=chunlei&clienttype=0&web=1";
	var DB = chrome.storage.local;
	var send = chrome.tabs.sendMessage;
	var bdstoken = null;
	var context = [
		{type:"link",name:"链接"},
		{type:"image",name:"图片"}
	];
	
	var vcodeTabId = null;
	var postData = {
		method: "add_task",
		app_id: 250528, 
		save_path: "/"
	};
	var resUrl = null;

	function _makeForm(data) {
		var form = "";
		for (var k in data) {
			form += k;
			form += ("=" + encodeURIComponent(data[k]) + "&");
		}
		form.slice(0, -1);
		return form;
	}

	function _ajaxGet(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		xhr.onload = function(e) {
			callback(e.target.responseText);
		};
		xhr.send(null);
	}

	function _ajaxPost(url, data, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", url, true);
		xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xhr.onreadystatechange=function() {
		  	if (xhr.readyState==4/* && xhr.status==200*/) {
		    	callback(xhr.responseText);
		    }
		};
		xhr.send(_makeForm(data));
	}

	function setBdstoken(token) {
		bdstoken = token;
		DB.set({bdstoken:token});
	}

	function _getBdstokenFromPage(callback) {
		_ajaxGet(BAIDUYUN_URL, function(responseText) {
			var reg = /bdstoken=\"([^\"]*)\"/g;
			var token = reg.exec(responseText)[1];
			setBdstoken(token);
			callback(token);
		});
	}

	function getBdstoken(callback) {
		if (bdstoken) {
			return callback(bdstoken);
		}
		DB.get("bdstoken", function(item) {
			if (item.bdstoken) {
				bdstoken = item.bdstoken;
				return callback(item.bdstoken)
			}
			_getBdstokenFromPage(callback);
		});
	}

	function saveToBaiduPan(data, callback) {
		var destUrl = BAIDUPAN_SAVE_URL + "&bdstoken=" + data.token;
		postData.source_url = data.url;
		data.vcode&&(postData.vcode = data.vcode);
		data.input&&(postData.input = data.input);
		_ajaxPost(destUrl, postData, function(text) {
			callback(JSON.parse(text));
		});
	}

	function onCbSaveToBaidu(retJson) {
		if (retJson.error_code == -19) {
			if (vcodeTabId) {
				send(vcodeTabId, {
					cmd: "error",
					vcode: retJson.vcode,
	        		img: retJson.img
				});
				return;
			}

			chrome.windows.create({
	            url: chrome.extension.getURL("vcode.html"),
	            type: "popup",
	            width: 230,
	            height: 100
	        }, function(w) {
	        	vcodeTabId = w.tabs[0].id;
	        	send(vcodeTabId, {
	        		cmd:"init",
	        		id: w.id,
	        		vcode: retJson.vcode,
	        		img: retJson.img
	        	});
	        });
		}

		if (retJson.task_id && retJson.rapid_download) {
			if (vcodeTabId)
				send(vcodeTabId, {cmd:"close"});
			var notify = chrome.notifications;
			if (notify) {
				notify.create("", {
					type: "basic",
			        title: "提示",
			        message: "已成功添加到百度云盘离线下载列表中",
			        iconUrl: "icon.png"
				}, function() {});
				return;
			}
			alert("已成功添加到百度云盘离线下载列表中");
		}
	}

	// function onCookieChange() {

	// }

	function onMenuItemClick(info, tab) {
		if (info.mediaType == "image") {
			resUrl = info.srcUrl;
		} else {
			resUrl = info.linkUrl;
		}

		chrome.cookies.get({url:BAIDUYUN_URL, name:"BDUSS"}, function(cookie) {
			if (!cookie) {
				bdstoken = "";
				chrome.tabs.create({url:BAIDUYUN_URL});
				return;
			}

			getBdstoken(function(token) {
				if(!token)
					return;
				saveToBaiduPan({
					url:resUrl, 
					token:token
				}, onCbSaveToBaidu);
			});
		});
	}

	//menu初始化
	for (var i = 0; i < context.length; i++) {
		var item = context[i];
		chrome.contextMenus.create({
			"title": "将" + item.name + "保存到百度网盘", 
			"contexts":[item.type], 
			"onclick": onMenuItemClick
		});
	}

	chrome.runtime.onMessage.addListener(function(msg, sender) {
		saveToBaiduPan({
			url:resUrl,
			token:bdstoken,
			vcode:msg.vcode,
			input:msg.input
		}, onCbSaveToBaidu);
	});

	chrome.windows.onRemoved.addListener(function() {
		vcodeTabId = null;
	});
}());