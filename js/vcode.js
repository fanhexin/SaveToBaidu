(function(){
	var d = document;
	var vcode;
	var imgUrl;
	var id;

	function exit() {
		chrome.windows.remove(id);
	}

	d.addEventListener('DOMContentLoaded', function () {
		d.getElementById("change-img-code-btn").onclick = function() {
			var newImgUrl = imgUrl + "&" + (new Date()).getTime();
			d.getElementById('img-code').src = newImgUrl;
		};

		d.getElementById("ok-btn").onclick = function() {
			var code = d.getElementById("input-code");
			if (!code.value) {
				code.focus();
				return;
			} else if (code.value.length != 4) {
				code.select();
				code.focus();
				return;
			}

			chrome.runtime.sendMessage(chrome.runtime.id, {
				vcode: vcode,
				input: code.value
			});
		};
	});

	chrome.runtime.onMessage.addListener(function(msg, sender) {
		switch (msg.cmd) {
			case "init":
				id = msg.id;
				vcode = msg.vcode;
				imgUrl = msg.img;
				d.getElementById('img-code').src = msg.img;
				break;
			case "error":
				vcode = msg.vcode;
				imgUrl = msg.img;
				d.getElementById('img-code').src = msg.img;
				alert("error!");
				var vError = d.getElementById("verify-error");
				vError.text = "验证码错误，请重新输入!";
				break;
			case "close":
				exit();
				break;
			default:
				break;
		}		
	});
}());