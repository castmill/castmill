Utility=(function(){var b,a;function d(e){}if(typeof window==="object"){cordova.define("cordova/plugin/utility",function(f,e,g){b=function(){};if(window.PalmSystem){d("Window.PalmSystem Available");a=f("cordova/plugin/webos/service")}else{a={Request:function(h,i){d(h+" invoked. But I am a dummy because PalmSystem is not available");if(typeof i.onFailure==="function"){i.onFailure({returnValue:false,errorText:"PalmSystem Not Available. Cordova is not installed?"})}}}}g.exports=b});b=cordova.require("cordova/plugin/utility")}else{b=function(e){a=e;a.Request=function(f,h){var g=f+"/"+h.method;var i={};if(h.hasOwnProperty("parameters")===true){i=h.parameters}var j={};var k=function(l){console.log("res : "+JSON.stringify(l));if(l.payload.returnValue===true){j=l.payload;h.onSuccess(j)}else{j.returnValue=false;j.errorCode=l.payload.errorCode;j.errorText=l.payload.errorText;h.onFailure(j)}};if(a){a.call(g,i,k)}}};module.exports=b}function c(f,g,e){if(f.errorCode===undefined||f.errorCode===null){f.errorCode=g}if(f.errorText===undefined||f.errorText===null){f.errorText=e}}b.prototype.createToast=function(f,g,h){d("createToast: "+h.msg);if(h.msg===null&&typeof g==="function"){var e={};c(e,"UTCT","Utility.createToast returns failure. command was not defined.");g(e);d("Utility.createToast invalid ");return}a.Request("luna://com.webos.service.commercial.scapadapter/",{method:"createToast",parameters:{text:h.msg},onSuccess:function(i){d("createToast: On Success");if(i.returnValue===true){if(typeof f==="function"){d("call successCallback");f()}}},onFailure:function(i){d("createToast: On Failure");delete i.returnValue;if(typeof g==="function"){c(i,"UTCT","Utility.createToast returns failure.");g(i)}}});d("Utility.createToast Done")};return b}());