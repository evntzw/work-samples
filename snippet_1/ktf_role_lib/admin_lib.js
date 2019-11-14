/*
 * /lib/ktf_role_lib/admin_lib.js
 * KTF Hyperledger Composer Admin Library
*/
'use strict';

/**
 * @module adminLib
 * @desc Contains admin library methods
 */
module.exports = function(ktfLib) {
    var adminLib = {} // To export functions to be used publicly

    /* Participant Related Functions */

    /**
     * Function to create participant resource
     * @async
     * @function createParticipant
     * @memberof module:adminLib
     * @instance
     * @param {String} _participantType - Participant type
     * @param {String} _participantId - Participant Id
     * @param {Object} _fieldMap - Field Map
     * @returns {Participant} - newly created Participant
     */
    adminLib.createParticipant = async function(_participantType, _participantId, _fieldMap) {
        //create resource object
        let res = ktfLib.factory.newResource(ktfLib.namespace, _participantType, _participantId);
        //currently, none of our participants has any fields
        if (typeof _fieldMap == "object")
            for (var key in _fieldMap) {
                res[key] = _fieldMap[key];
            };

        //get participant registry (caching)
        if (ktfLib.participantRegistries[_participantType] == undefined)
            ktfLib.participantRegistries[_participantType] = await ktfLib.connection.getParticipantRegistry(ktfLib.namespace + '.' + _participantType);

        await ktfLib.participantRegistries[_participantType].addAll([res]);
        return res;
    }

    /**
     * Create Participant record based on the account role passed in (for backend)
     * @async
     * @function createParticipantByRole
     * @memberof module:adminLib
     * @instance
     * @param {String} role - Participant role
     * @param {String} userId - Participant Id
     * @param {String} regionId - Region Id for Importer role
     * @param {Float} logisticsCost - Logistics cost for Logistics role
     */
    adminLib.createParticipantByRole = async function(role, userId, regionId, logisticsCost) {
        var partObj;
        switch(role) {
            case 'Importer':
                partObj = await this.createParticipant(role, userId, {
                    region: ktfLib.factory.newRelationship(ktfLib.namespace, 'Region', regionId),
                    approvedPools: []
                });
                break;
            case 'Logistics':
                partObj = await this.createParticipant(role, userId, {
                    logisticsCost: logisticsCost
                });
                break;
            default:
                partObj = await this.createParticipant(role, userId);
                break;
        }

        await ktfLib.issueParticipant(partObj, userId);
    }

    /* Asset Related Functions */

    /**
     * Function to create asset of any type
     * @async
     * @function createAsset
     * @memberof module:adminLib
     * @instance
     * @param {String} _assetType - Asset type
     * @param {String} _assetId - Asset Id
     * @param {Object} _fieldMap - Field Map
     */
    adminLib.createAsset = async function(_assetType, _assetId, _fieldMap) {
        //create resource object
        let res = ktfLib.factory.newResource(ktfLib.namespace, _assetType, _assetId);
        if (typeof _fieldMap == "object")
            for (var key in _fieldMap) {
                res[key] = _fieldMap[key];
            };

        //get asset registry (caching)
        if (ktfLib.assetRegistries[_assetType] == undefined)
            ktfLib.assetRegistries[_assetType] = await ktfLib.connection.getAssetRegistry(ktfLib.namespace + "." + _assetType);

        await ktfLib.assetRegistries[_assetType].addAll([res]);
    }

    /**
     * Function to create Region asset
     * @async
     * @function createRegion
     * @memberof module:adminLib
     * @instance
     * @param {String} regionId - Region Id
     */
    adminLib.createRegion = async function(regionId) {
        await this.createAsset('Region', regionId);
    }
    
    /**
     * Function to create Product asset
     * @async
     * @function createProduct
     * @memberof adminLib
     * @instance
     * @param {String} productId - Product Id
     */
    adminLib.createProduct = async function(productId, productDescription = "") {
        await this.createAsset('Product', productId, { productDescription: productDescription });
    }

    /**
     * Function to create Platform Setting with platform fee
     * @async
     * @function setPlatformFee
     * @memberof module:adminLib
     * @instance
     * @param {Float} platformFee - Platform Fee
     * @returns {Asset} - Platform Setting Asset
     */
    adminLib.setPlatformFee = async function(platformFee) {
        return await this.createAsset('PlatformSetting', 'platformFee', {
            numValue: platformFee
        });
    }

    /**
     * Function to create Document Class Asset
     * @async
     * @function createDocumentClass
     * @memberof module:adminLib
     * @instance
     * @param {String} documentClass - Document Class
     */
    adminLib.createDocumentClass = async function(documentClass) {
        await this.createAsset('DocumentClass', documentClass);
    }

    /**
     * Function to return list of all Participants of a given type
     * @async
     * @function listParticipantsByType
     * @memberof module:adminLib
     * @instance
     * @param {String} type - Participant type
     * @returns {Participant[]} - List of Participants
     */
    adminLib.listParticipantsByType = async function(type) {
        return await ktfLib.getParticipants(type);
    }

    /**
     * Function to return list of all Assets of a given type
     * @async
     * @function listAssetsByType
     * @memberof module:adminLib
     * @instance
     * @param {String} type - Asset type
     * @returns {Asset[]} - List of Assets
     */
    adminLib.listAssetsByType = async function(type) {
        return await ktfLib.getAssets(type);
    }

    return adminLib;
}
