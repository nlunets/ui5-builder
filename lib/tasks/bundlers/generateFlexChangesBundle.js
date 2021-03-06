const log = require("@ui5/logger").getLogger("builder:tasks:bundlers:generateFlexChangesBundle");
const flexChangesBundler = require("../../processors/bundlers/flexChangesBundler");

/**
 * Task to create changesBundle.json file containing all changes stored in the /changes folder for easier consumption
 * at runtime.
 * If a change bundle is created, "sap.ui.fl" is added as a dependency to the manifest.json if not already present -
 * if the dependency is already listed but lazy-loaded, lazy loading is disabled.
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateFlexChangesBundle
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {Object} [parameters.options] Options
 * @param {string} [parameters.options.namespace] Application Namespace
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, options}) {
	// Use the given namespace if available, otherwise use no namespace
	// (e.g. in case no manifest.json is present)
	let pathPrefix = "";
	if (options && options.namespace) {
		pathPrefix = `/resources/${options.namespace}`;
	}

	function updateJson(data) {
		// ensure the existence of the libs section in the dependencies
		data["sap.ui5"] = data["sap.ui5"] || {};
		data["sap.ui5"].dependencies = data["sap.ui5"].dependencies || {};
		const mLibs = data["sap.ui5"].dependencies.libs = data["sap.ui5"].dependencies.libs || {};

		if (mLibs["sap.ui.fl"]) {
			log.verbose("sap.ui.fl found in manifest.json");
			if (mLibs["sap.ui.fl"].lazy) {
				log.verbose("sap.ui.fl 'lazy' attribute found in manifest.json, setting it to false...");
				mLibs["sap.ui.fl"].lazy = false;
			}
		} else {
			log.verbose("sap.ui.fl not found in manifest.json, inserting it...");
			mLibs["sap.ui.fl"] = {};
		}
	}

	async function updateFLdependency() {
		const manifestResource = await workspace.byPath(`${pathPrefix}/manifest.json`);
		const manifestContent = JSON.parse(await manifestResource.getString());

		updateJson(manifestContent);
		manifestResource.setString(JSON.stringify(manifestContent, null, "\t"));

		await workspace.write(manifestResource);
	}

	log.verbose("Collecting flexibility changes");
	return workspace.byGlob(`${pathPrefix}/changes/*.change`)
		.then((allResources) => {
			return flexChangesBundler({
				resources: allResources,
				options: {
					namespace: options.namespace,
					pathPrefix: pathPrefix
				}
			});
		})
		.then((processedResources) => {
			return Promise.all(processedResources.map((resource) => {
				log.verbose("Writing flexibility changes bundle");
				return workspace.write(resource);
			})).then(async () => {
				// Add the sap.ui.fl dependency if a bundle has been created
				if (processedResources.length > 0) {
					await updateFLdependency();
				}
			});
		});
};
