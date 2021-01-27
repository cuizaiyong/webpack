/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");

const OptionsDefaulter = require("./OptionsDefaulter");
const Template = require("./Template");

const isProductionLikeMode = options => {
	return options.mode === "production" || !options.mode;
};

const isWebLikeTarget = options => {
	return options.target === "web" || options.target === "webworker";
};

const getDevtoolNamespace = library => {
	// if options.output.library is a string
	if (Array.isArray(library)) {
		return library.join(".");
	} else if (typeof library === "object") {
		return getDevtoolNamespace(library.root);
	}
	return library || "";
};

class WebpackOptionsDefaulter extends OptionsDefaulter {
	constructor() {
		super();
		// 默认入口是src下面的index.js
		this.set("entry", "./src");
		// devtool有几种值 eval cheap module source map false
		this.set("devtool", "make", options =>
			options.mode === "development" ? "eval" : false
		);
		// 缓存生成的webpack模块和chunk模块，在开发模式下被设置成true或者{ type: 'memory' }
		// 在生产模式下，禁用，值为false
		this.set("cache", "make", options => options.mode === "development");
		// compile的context所在路径
		this.set("context", process.cwd());
		// 默认构建web
		this.set("target", "web");

		this.set("module", "call", value => Object.assign({}, value));
		this.set("module.unknownContextRequest", ".");
		this.set("module.unknownContextRegExp", false);
		this.set("module.unknownContextRecursive", true);
		this.set("module.unknownContextCritical", true);
		this.set("module.exprContextRequest", ".");
		this.set("module.exprContextRegExp", false);
		this.set("module.exprContextRecursive", true);
		this.set("module.exprContextCritical", true);
		this.set("module.wrappedContextRegExp", /.*/);
		this.set("module.wrappedContextRecursive", true);
		this.set("module.wrappedContextCritical", false);
		this.set("module.strictExportPresence", false);
		this.set("module.strictThisContextOnImports", false);
		this.set("module.unsafeCache", "make", options => !!options.cache);
		// 默认loader为空
		this.set("module.rules", []);
		this.set("module.defaultRules", "make", options => [
			{
				type: "javascript/auto",
				resolve: {}
			},
			{
				test: /\.mjs$/i,
				type: "javascript/esm",
				resolve: {
					mainFields:
						options.target === "web" ||
						options.target === "webworker" ||
						options.target === "electron-renderer"
							? ["browser", "main"]
							: ["main"]
				}
			},
			{
				test: /\.json$/i,
				type: "json"
			},
			{
				test: /\.wasm$/i,
				type: "webassembly/experimental"
			}
		]);

		this.set("output", "call", (value, options) => {
			if (typeof value === "string") {
				return {
					filename: value
				};
			} else if (typeof value !== "object") {
				return {};
			} else {
				return Object.assign({}, value);
			}
		});
		// 默认输出文件名规则
		this.set("output.filename", "[name].js");
		// 默认非入口chunk的名称 [id].js
		this.set("output.chunkFilename", "make", options => {
			const filename = options.output.filename;
			if (typeof filename !== "function") {
				const hasName = filename.includes("[name]");
				const hasId = filename.includes("[id]");
				const hasChunkHash = filename.includes("[chunkhash]");
				// Anything changing depending on chunk is fine
				if (hasChunkHash || hasName || hasId) return filename;
				// Elsewise prefix "[id]." in front of the basename to make it changing
				return filename.replace(/(^|\/)([^/]*(?:\?|$))/, "$1[id].$2");
			}
			return "[id].js";
		});
		this.set("output.webassemblyModuleFilename", "[modulehash].module.wasm");
		// library的值取决于libraryTarget的值，libraryTarget的值默认是var
		// 用于指定输出的是什么类型的模块，对应模块名
		this.set("output.library", "");
		// 在webpack5里面已经禁用了，而是使用hotUpdateGlobal
		// 只在target是web的时候才生效，用于加载热更新的JSONP函数
		// JSONP函数用于异步加载热更新chunk
		this.set("output.hotUpdateFunction", "make", options => {
			return Template.toIdentifier(
				"webpackHotUpdate" + Template.toIdentifier(options.output.library)
			);
		});
		// 只在 target 是 web 时使用，用于按需加载(load on-demand) chunk 的 JSONP 函数。
		this.set("output.jsonpFunction", "make", options => {
			return Template.toIdentifier(
				"webpackJsonp" + Template.toIdentifier(options.output.library)
			);
		});
		// webpack5里面正是更名为chunkLoadingGlobal
		// webpack 用于加载 chunk 的全局变量。
		this.set("output.chunkCallbackName", "make", options => {
			return Template.toIdentifier(
				"webpackChunk" + Template.toIdentifier(options.output.library)
			);
		});
		// 当输出为 library 时，尤其是当 libraryTarget 为 'umd'时
		// ，此选项将决定使用哪个全局对象来挂载 library。
		// 为了使 UMD 构建在浏览器和 Node.js 上均可用，
		// 应将 output.globalObject 选项设置为 'this'。
		// 对于类似 web 的目标，默认为 self。
		this.set("output.globalObject", "make", options => {
			switch (options.target) {
				case "web":
				case "electron-renderer":
				case "node-webkit":
					return "window";
				case "webworker":
					return "self";
				case "node":
				case "async-node":
				case "electron-main":
					return "global";
				default:
					return "self";
			}
		});
		// 此选项确定 output.devtoolModuleFilenameTemplate 使用的模块名称空间。
		// 未指定时的默认值为：output.library。
		// 在加载多个通过 webpack 构建的 library 时，用于防止 source map 中源文件路径冲突。
		this.set("output.devtoolNamespace", "make", options => {
			return getDevtoolNamespace(options.output.library);
		});
		this.set("output.libraryTarget", "var");
		// 默认输出目录是dist
		this.set("output.path", path.join(process.cwd(), "dist"));
		this.set(
			"output.pathinfo",
			"make",
			options => options.mode === "development"
		);
		this.set("output.sourceMapFilename", "[file].map[query]");
		this.set("output.hotUpdateChunkFilename", "[id].[hash].hot-update.js");
		this.set("output.hotUpdateMainFilename", "[hash].hot-update.json");
		this.set("output.crossOriginLoading", false);
		this.set("output.jsonpScriptType", false);
		// jsonp加载chunk的超时时间
		this.set("output.chunkLoadTimeout", 120000);
		// 生成hash的算法，Crypto.createHash 默认采用md4
		this.set("output.hashFunction", "md4");
		// 在生成 hash 时使用的编码方式，默认为 'hex'。
		// 支持 Node.js hash.digest 的所有编码。
		// 对文件名使用 'base64'，可能会出现问题，
		// 因为 base64 字母表中具有 / 这个字符(character)。
		// 同样的，'latin1' 规定可以含有任何字符(character)。
		this.set("output.hashDigest", "hex");
		// 散列摘要的前缀长度
		this.set("output.hashDigestLength", 20);
		// deprecated
		this.set("output.devtoolLineToLine", false);
		// 如果一个模块是在 require 时抛出异常，告诉 webpack 从模块实例缓存(require.cache)中删除这个模块。
		this.set("output.strictModuleExceptionHandling", false);

		this.set("node", "call", value => {
			if (typeof value === "boolean") {
				return value;
			} else {
				return Object.assign({}, value);
			}
		});
		this.set("node.console", false);
		// 默认提供process垫片，webpack5已经deprecated
		this.set("node.process", true);
		// 默认提供global垫片，webpack5已经deprecated
		this.set("node.global", true);
		// 默认提供Buffer垫片，webpack5已经deprecated
		this.set("node.Buffer", true);
		// 默认提供setImmediate垫片，webpack5已经deprecated
		this.set("node.setImmediate", true);
		this.set("node.__filename", "mock");
		this.set("node.__dirname", "mock");

		this.set("performance", "call", (value, options) => {
			if (value === false) return false;
			if (
				value === undefined &&
				(!isProductionLikeMode(options) || !isWebLikeTarget(options))
			)
				return false;
			return Object.assign({}, value);
		});
		// 资源(asset)是从 webpack 生成的任何文件。
		// 此选项根据单个资源体积，控制 webpack 何时生成性能提示。
		// 默认值是：250000 (bytes)。
		this.set("performance.maxAssetSize", 250000);
		// 入口起点表示针对指定的入口，对于所有资源，
		// 要充分利用初始加载时(initial load time)期间。
		// 此选项根据入口起点的最大体积，控制 webpack 何时生成性能提示。
		// 默认值是：250000 (bytes)。
		this.set("performance.maxEntrypointSize", 250000);
		// 打开/关闭提示。此外，当找到提示时，告诉 webpack 抛出一个错误或警告。
		// 此属性默认设置为 "warning"。
		this.set("performance.hints", "make", options =>
			isProductionLikeMode(options) ? "warning" : false
		);

		this.set("optimization", "call", value => Object.assign({}, value));
		// TODO webpack 5: Disable by default in a modes
		this.set(
			"optimization.removeAvailableModules",
			"make",
			options => options.mode !== "development"
		);
		// 如果 chunk 为空，告知 webpack 检测或移除这些 chunk。
		this.set("optimization.removeEmptyChunks", true);
		// 告知 webpack 合并含有相同模块的 chunk
		this.set("optimization.mergeDuplicateChunks", true);
		// 告知 webpack 确定和标记出作为其他 chunk 子集的那些 chunk，其方式是在已经加载过较大的 chunk 之后，
		// 就不再去加载这些 chunk 子集。
		this.set("optimization.flagIncludedChunks", "make", options =>
			isProductionLikeMode(options)
		);
		// TODO webpack 5 add `moduleIds: "named"` default for development
		// TODO webpack 5 add `moduleIds: "size"` default for production
		// TODO webpack 5 remove optimization.occurrenceOrder
		this.set("optimization.occurrenceOrder", "make", options =>
			isProductionLikeMode(options)
		);
		// 副作用控制器，如果是false，代表所有文件都没有副作用，webpack
		// 在tree-shaking的时候，将不再做判断
		this.set("optimization.sideEffects", "make", options =>
			isProductionLikeMode(options)
		);
		// 告诉webpack哪些导出是由模块提供的，对于export * from ，可以更加高效的生成代码
		this.set("optimization.providedExports", true);
		// 告诉webpack确定每个模块使用的导出。 这取决于optimize.providedExports。
		//  由optimization.usedExports收集的信息将被其他优化或代码生成所使用，即，
		// 不会为未使用的导出生成导出，当所有用法兼容时，导出名称将被压缩为单个字符标识符。
		//  最小化器中消除死代码将受益于此，并且可以删除未使用的导出。
		this.set("optimization.usedExports", "make", options =>
			isProductionLikeMode(options)
		);
		// 可以让webpack根据模块间的关系依赖图中，将所有的模块连接成一个模块。
		this.set("optimization.concatenateModules", "make", options =>
			isProductionLikeMode(options)
		);
		this.set("optimization.splitChunks", {});
		this.set("optimization.splitChunks.hidePathInfo", "make", options => {
			return isProductionLikeMode(options);
		});
		this.set("optimization.splitChunks.chunks", "async");
		this.set("optimization.splitChunks.minSize", "make", options => {
			return isProductionLikeMode(options) ? 30000 : 10000;
		});
		this.set("optimization.splitChunks.minChunks", 1);
		this.set("optimization.splitChunks.maxAsyncRequests", "make", options => {
			return isProductionLikeMode(options) ? 5 : Infinity;
		});
		this.set("optimization.splitChunks.automaticNameDelimiter", "~");
		this.set("optimization.splitChunks.automaticNameMaxLength", 109);
		this.set("optimization.splitChunks.maxInitialRequests", "make", options => {
			return isProductionLikeMode(options) ? 3 : Infinity;
		});
		this.set("optimization.splitChunks.name", true);
		this.set("optimization.splitChunks.cacheGroups", {});
		this.set("optimization.splitChunks.cacheGroups.default", {
			automaticNamePrefix: "",
			reuseExistingChunk: true,
			minChunks: 2,
			priority: -20
		});
		this.set("optimization.splitChunks.cacheGroups.vendors", {
			automaticNamePrefix: "vendors",
			test: /[\\/]node_modules[\\/]/,
			priority: -10
		});
		this.set("optimization.runtimeChunk", "call", value => {
			if (value === "single") {
				return {
					name: "runtime"
				};
			}
			if (value === true || value === "multiple") {
				return {
					name: entrypoint => `runtime~${entrypoint.name}`
				};
			}
			return value;
		});
		this.set("optimization.noEmitOnErrors", "make", options =>
			isProductionLikeMode(options)
		);
		this.set("optimization.checkWasmTypes", "make", options =>
			isProductionLikeMode(options)
		);
		this.set("optimization.mangleWasmImports", false);
		// TODO webpack 5 remove optimization.namedModules
		this.set(
			"optimization.namedModules",
			"make",
			options => options.mode === "development"
		);
		this.set("optimization.hashedModuleIds", false);
		// TODO webpack 5 add `chunkIds: "named"` default for development
		// TODO webpack 5 add `chunkIds: "size"` default for production
		// TODO webpack 5 remove optimization.namedChunks
		this.set(
			"optimization.namedChunks",
			"make",
			options => options.mode === "development"
		);
		this.set(
			"optimization.portableRecords",
			"make",
			options =>
				!!(
					options.recordsInputPath ||
					options.recordsOutputPath ||
					options.recordsPath
				)
		);
		this.set("optimization.minimize", "make", options =>
			isProductionLikeMode(options)
		);
		this.set("optimization.minimizer", "make", options => [
			{
				apply: compiler => {
					// Lazy load the Terser plugin
					const TerserPlugin = require("terser-webpack-plugin");
					const SourceMapDevToolPlugin = require("./SourceMapDevToolPlugin");
					new TerserPlugin({
						cache: true,
						parallel: true,
						sourceMap:
							(options.devtool && /source-?map/.test(options.devtool)) ||
							(options.plugins &&
								options.plugins.some(p => p instanceof SourceMapDevToolPlugin))
					}).apply(compiler);
				}
			}
		]);
		this.set("optimization.nodeEnv", "make", options => {
			// TODO: In webpack 5, it should return `false` when mode is `none`
			return options.mode || "production";
		});

		this.set("resolve", "call", value => Object.assign({}, value));
		this.set("resolve.unsafeCache", true);
		this.set("resolve.modules", ["node_modules"]);
		this.set("resolve.extensions", [".wasm", ".mjs", ".js", ".json"]);
		this.set("resolve.mainFiles", ["index"]);
		this.set("resolve.aliasFields", "make", options => {
			if (
				options.target === "web" ||
				options.target === "webworker" ||
				options.target === "electron-renderer"
			) {
				return ["browser"];
			} else {
				return [];
			}
		});
		this.set("resolve.mainFields", "make", options => {
			if (
				options.target === "web" ||
				options.target === "webworker" ||
				options.target === "electron-renderer"
			) {
				return ["browser", "module", "main"];
			} else {
				return ["module", "main"];
			}
		});
		this.set("resolve.cacheWithContext", "make", options => {
			return (
				Array.isArray(options.resolve.plugins) &&
				options.resolve.plugins.length > 0
			);
		});

		this.set("resolveLoader", "call", value => Object.assign({}, value));
		this.set("resolveLoader.unsafeCache", true);
		this.set("resolveLoader.mainFields", ["loader", "main"]);
		this.set("resolveLoader.extensions", [".js", ".json"]);
		this.set("resolveLoader.mainFiles", ["index"]);
		this.set("resolveLoader.cacheWithContext", "make", options => {
			return (
				Array.isArray(options.resolveLoader.plugins) &&
				options.resolveLoader.plugins.length > 0
			);
		});

		this.set("infrastructureLogging", "call", value =>
			Object.assign({}, value)
		);
		this.set("infrastructureLogging.level", "info");
		this.set("infrastructureLogging.debug", false);
	}
}

module.exports = WebpackOptionsDefaulter;
