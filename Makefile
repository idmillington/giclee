all:
	cat static/css/test-common.less static/css/test1-client.less | node_modules/less/bin/lessc - static/css/test1-client.css
	cat static/js/gce-utils.js static/js/gce-managers.js static/js/gce-ui.js | node_modules/uglify-js/bin/uglifyjs > static/js/gce.min.js
