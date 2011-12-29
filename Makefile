all:
	cat samples/static/css/sample-common.less samples/static/css/sample1-client.less | node_modules/less/bin/lessc - samples/static/css/sample1-client.css
	mkdir -p out
	cat src/gce-utils.js src/gce-managers.js src/gce-ui.js | node_modules/uglify-js/bin/uglifyjs > out/gce.min.js
	cp out/gce.min.js samples/static/js/
