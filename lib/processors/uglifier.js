const terser = require("terser");
const copyrightCommentsPattern = /copyright|\(c\)(?:[0-9]+|\s+[0-9A-za-z])|released under|license|\u00a9/i;
const EvoResource = require("@ui5/fs").Resource;

/**
 * Minifies the supplied resources.
 *
 * @public
 * @alias module:@ui5/builder.processors.uglifier
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with uglified resources
 */
module.exports = function({resources}) {
	return Promise.all(resources.map((resource) => {
		return resource.getString().then((code) => {
			const result = terser.minify({
				[resource.getPath()]: code
			}, {
				sourceMap: {
					content: "inline",
					url: resource.getPath() + ".map"
				},
				warnings: false,
				output: {
					comments: copyrightCommentsPattern,
					wrap_func_args: false
				},
				compress: false
			});
			if (result.error) {
				throw new Error(
					`Uglification failed with error: ${result.error.message} in file ${result.error.filename} ` +
					`(line ${result.error.line}, col ${result.error.col}, pos ${result.error.pos})`);
			}
			const sourceMapResource = new EvoResource({
				path: resource.getPath() + ".map",
				string: result.map
			});
			resource.setString(result.code);
			return [sourceMapResource, resource];
		});
	})).then((resources) => [].concat(...resources));
};
