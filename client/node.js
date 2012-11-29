(function (define) {

	define(function (require) {
		"use strict";

		var parser, http, https, when, UrlBuilder, normalizeHeaderName, httpsExp;

		parser = require('url');
		http = require('http');
		https = require('https');
		when = require('when');
		UrlBuilder = require('../UrlBuilder');
		normalizeHeaderName = require('../util/normalizeHeaderName');

		httpsExp = /^https/i;

		function node(request) {

			var d, options, clientRequest, client, url, headers, entity, response;

			d = when.defer();

			url = new UrlBuilder(request.path || '', request.params).build();
			client = url.match(httpsExp) ? https : http;

			options = parser.parse(url);
			entity = request.entity;
			request.method = request.method || (entity ? 'POST' : 'GET');
			options.method = request.method;
			headers = options.headers = {};
			Object.keys(request.headers || {}).forEach(function (name) {
				headers[normalizeHeaderName(name)] = request.headers[name];
			});
			if (!headers['Content-Length']) {
				headers['Content-Length'] = entity ? Buffer.byteLength(entity, 'utf8') : 0;
			}

			response = {};
			response.request = request;

			request.canceled = false;
			request.cancel = function cancel() {
				request.canceled = true;
				clientRequest.abort();
			};

			try {
				clientRequest = client.request(options, function (clientResponse) {
					response.raw = clientResponse;
					response.status = {
						code: clientResponse.statusCode
						// node doesn't provide access to the status text
					};
					response.headers = {};
					Object.keys(clientResponse.headers).forEach(function (name) {
						response.headers[normalizeHeaderName(name)] = clientResponse.headers[name];
					});

					clientResponse.on('data', function (data) {
						if (!('entity' in response)) {
							response.entity = '';
						}
						// normalize Buffer to a String
						response.entity += data.toString();
					});
					clientResponse.on('end', function () {
						d.resolve(response);
					});
				});
				
				clientRequest.on('error', function (e) {
					response.error = e;
					d.reject(response);
				});

				if (entity) {
					clientRequest.write(entity);
				}
				clientRequest.end();
			}
			catch (e) {
				d.reject(e);
			}

			return d.promise;
		}

		return node;

	});

}(
	typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }
	// Boilerplate for AMD and Node
));
