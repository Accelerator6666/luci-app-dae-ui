'use strict';
'require baseclass';
'require daeui.completion as completion';

var _promise = null;

function loadStyle(href) {
	if (document.querySelector('link[href="' + href + '"]')) return;
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = href;
	document.head.appendChild(link);
}

function loadScript(src) {
	return new Promise(function(resolve, reject) {
		if (document.querySelector('script[src="' + src + '"]')) {
			resolve();
			return;
		}
		var s = document.createElement('script');
		s.src = src;
		s.async = false;
		s.onload = resolve;
		s.onerror = function() { reject(new Error('Failed to load ' + src)); };
		document.head.appendChild(s);
	});
}

function ensure() {
	if (_promise) return _promise;
	loadStyle(L.resource('daeui/lib/codemirror.css'));
	loadStyle(L.resource('daeui/addon/fold/foldgutter.css'));
	loadStyle(L.resource('daeui/editor.css'));

	_promise = loadScript(L.resource('daeui/lib/codemirror.js'))
		.then(function() {
			return Promise.all([
				loadScript(L.resource('daeui/addon/edit/matchbrackets.js')),
				loadScript(L.resource('daeui/addon/edit/closebrackets.js')),
				loadScript(L.resource('daeui/addon/fold/foldcode.js')),
				loadScript(L.resource('daeui/addon/fold/foldgutter.js')),
				loadScript(L.resource('daeui/addon/fold/indent-fold.js')),
				loadScript(L.resource('daeui/mode/dae/dae.js'))
			]);
		})
		.then(function() { return window.CodeMirror; });

	return _promise;
}

function sameDiagnosticFile(diagFile, currentPath) {
	if (!diagFile) return true;
	if (!currentPath) return false;
	if (diagFile === currentPath) return true;
	return currentPath.slice(-(diagFile.length + 1)) === '/' + diagFile ||
		diagFile.slice(-(currentPath.length + 1)) === '/' + currentPath;
}

function installDiagnostics(cm) {
	cm._daeDiagnosticLines = [];

	cm.daeClearDiagnostics = function() {
		cm.clearGutter('dae-diagnostic-gutter');
		(cm._daeDiagnosticLines || []).forEach(function(line) {
			cm.removeLineClass(line, 'background', 'dae-diagnostic-line');
		});
		cm._daeDiagnosticLines = [];
	};

	cm.daeSetDiagnostics = function(items, currentPath) {
		cm.daeClearDiagnostics();
		var first = null;
		(items || []).forEach(function(d) {
			if (!sameDiagnosticFile(d.file || '', currentPath || '')) return;
			var line = Math.max(0, Number(d.line || 1) - 1);
			if (line >= cm.lineCount()) return;
			var marker = document.createElement('span');
			marker.className = 'dae-diagnostic-marker';
			marker.textContent = '●';
			marker.title = d.message || d.raw || 'DAE validation error';
			cm.setGutterMarker(line, 'dae-diagnostic-gutter', marker);
			cm.addLineClass(line, 'background', 'dae-diagnostic-line');
			cm._daeDiagnosticLines.push(line);
			if (first === null) first = line;
		});
		return first;
	};
}

function attach(textarea) {
	return ensure().then(function(CodeMirror) {
		if (textarea._daeEditor) return textarea._daeEditor;
		var cm = CodeMirror.fromTextArea(textarea, {
			mode: 'dae',
			lineNumbers: true,
			lineWrapping: false,
			matchBrackets: true,
			autoCloseBrackets: true,
			foldGutter: true,
			gutters: [ 'CodeMirror-linenumbers', 'dae-diagnostic-gutter', 'CodeMirror-foldgutter' ],
			indentUnit: 4,
			tabSize: 4
		});
		cm.setSize('100%', '68vh');
		installDiagnostics(cm);
		completion.attach(cm);
		textarea._daeEditor = cm;
		return cm;
	});
}

return baseclass.extend({
	ensure: ensure,
	attach: attach
});
