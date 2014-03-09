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
	var VCODE_MAC_WIDTH = 230;
	var VCODE_MAC_HEIGHT = 100;
	var VCODE_WIN_WIDTH = 246;
	var VCODE_WIN_HEIGHT = 138;
	var supportProtocols = [
		"http",
		"https",
		"ftp",
		"ed2k",
		"magnet"
	];
	var winId = null;
	var vcode = null;
	var img = null;

	function _isSupportProtocol(url) {
		var reg = /^([^:]*):.*/g;
		var ret = reg.exec(url);
		if (!ret) {
			return false;
		}
		var protocol = ret[1];
		for (var i = 0; i < supportProtocols.length; i++) {
			if (protocol == supportProtocols[i]) {
				return true;
			}
		}
		return false;
	}

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
		  	if (xhr.readyState == 4) {
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
		if (retJson.error_code) {
			if (retJson.error_code == -19) {
				if (vcodeTabId) {
					send(vcodeTabId, {
						cmd: "error",
						vcode: retJson.vcode,
		        		img: retJson.img
					});
					return;
				}

				//因为各平台窗口边框宽度不同，设置窗口不同宽高
				chrome.runtime.getPlatformInfo(function(platformInfo) {
					var width = (platformInfo.os == "win")?VCODE_WIN_WIDTH:VCODE_MAC_WIDTH;
					var height = (platformInfo.os == "win")?VCODE_WIN_HEIGHT:VCODE_MAC_HEIGHT;

					chrome.windows.create({
			            url: chrome.extension.getURL("vcode.html"),
			            type: "popup",
			            width: width,
			            height: height,
			            top: (window.screen.availHeight - height)/2,
			            left: (window.screen.availWidth - width)/2
			        }, function(w) {
			        	winId = w.id;
			        	vcodeTabId = w.tabs[0].id;
			        	vcode = retJson.vcode;
			        	img = retJson.img;
			        	
			        });
				});
			} else {
				alert("发生错误!");
				return;
			}
		}
		
		if (retJson.task_id) {
			if (vcodeTabId)
				send(vcodeTabId, {cmd:"close"});
			var notify = chrome.notifications;
			if (notify) {
				notify.create("", {
					type: "basic",
			        title: "提示",
			        message: "已成功添加到百度云盘离线下载列表中",
			        iconUrl: "img/icon.png"
				}, function() {});
				return;
			}
			alert("已成功添加到百度云盘离线下载列表中");
		}
	}

	function onMenuItemClick(info, tab) {
		if (info.mediaType == "image") {
			resUrl = info.srcUrl;
		} else {
			resUrl = info.linkUrl;
			if (!_isSupportProtocol(resUrl)) {
				return alert("目前百度网盘离线下载仅支持http/https/ftp/电驴/磁力链协议!");
			}
		}

		chrome.cookies.get({url:BAIDUYUN_URL, name:"BDUSS"}, function(cookie) {
			if (!cookie) {
				setBdstoken(null);
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
			"title": "将" + item.name + "添加到百度云网盘离线下载", 
			"contexts":[item.type], 
			"onclick": onMenuItemClick
		});
	}

	chrome.runtime.onMessage.addListener(function(msg, sender) {
		switch (msg.cmd) {
			case "finish":
				send(vcodeTabId, {
	        		cmd:"init",
	        		id: winId,
	        		vcode: vcode,
	        		img: img
	        	});
				break;
			case "post":
				saveToBaiduPan({
					url:resUrl,
					token:bdstoken,
					vcode:msg.vcode,
					input:msg.input
				}, onCbSaveToBaidu);
				break;
			default:
				break;
		}
	});

	chrome.windows.onRemoved.addListener(function() {
		vcodeTabId = null;
	});
}());