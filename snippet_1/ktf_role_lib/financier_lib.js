/*
 * /lib/ktf_role_lib/financier_lib.js
 * KTF Hyperledger Composer Financier Library
*/
'use strict';

/**
 * @module financierLib
 * @desc Contains financier library methods
 */
module.exports = function(ktfLib) {
    var finLib = {} // To export functions to be used publicly

    /* Asset Related functions  */
    
    /**
     * Function to get a paricular Pool asset
     * @async
     * @function getPool
     * @memberof module:financierLib
     * @instance
     * @param {String} poolId - Pool Id
     * @returns {Pool} - Pool asset
     */
    finLib.getPool = async function(poolId) {
        return await ktfLib.getAsset('Pool', poolId);
    }

    /**
     * Function to create a Pool asset
     * @async
     * @function createPool
     * @memberof module:financierLib
     * @instance
     * @param {String} poolId - Pool Id
     * @param {String} description - Description
     * @param {String} ethAddress - Ethereum Address
     * @param {String} t3 - t3
     * @param {String} max_commit_amt - max_commit_amt
     * @param {Float} deposit_ratio - deposit_ratio
     * @param {Float} interest_rate - interest_rate
     * @returns {String} - Pool Id
     */
    finLib.createPool = async function(poolId, description, ethAddress, t3, max_commit_amt, deposit_ratio, interest_rate) {
        var poolId = poolId || 'pool_' + Math.floor(Math.random() * 100000);

        var financierCreatePool = ktfLib.factory.newTransaction(ktfLib.namespace, 'FinancierCreatePool');
        financierCreatePool.poolId = poolId;
        financierCreatePool.owner = ktfLib.factory.newRelationship(ktfLib.namespace, 'Financier', ktfLib.userName);
        financierCreatePool.poolAddr = ethAddress;
        financierCreatePool.t3 = t3;
        financierCreatePool.description = description;
        financierCreatePool.max_commit_amt = max_commit_amt;
        financierCreatePool.deposit_ratio = deposit_ratio;
        financierCreatePool.interest_rate = interest_rate;

        await ktfLib.connection.submitTransaction(financierCreatePool)
            .catch(err => {
                throw ktfLib.filterError(err);
            });
        return poolId;
    }

     /**
     * Function to approve importer to be added in a Pool asset
     * @async
     * @function approvePool
     * @memberof module:financierLib
     * @instance
     * @param {String} poolId - Pool Id
     * @param {String} importerId - Importer Id
     * @returns {String} - Pool Id
     */
    finLib.approvePool = async function(importerId, poolId) {
        let approvePoolTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'ApprovePool');
        approvePoolTx.importer = ktfLib.factory.newRelationship(ktfLib.namespace, 'Importer', importerId);
        approvePoolTx.pool = ktfLib.factory.newRelationship(ktfLib.namespace, 'Pool', poolId);;
        await ktfLib.connection.submitTransaction(approvePoolTx);
        return poolId;
    }

     /**
     * Function to get approved importers of a Pool asset
     * @async
     * @function viewApprovedImporters
     * @memberof module:financierLib
     * @instance
     * @param {String} poolId - Pool Id
     * @returns {Importer[]} - List of approved Importers
     */
    finLib.viewApprovedImporters = async function(poolId) {
        let viewApprovedImportersTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'FinancierViewApprovedImporters');
        viewApprovedImportersTx.pool = ktfLib.factory.newRelationship(ktfLib.namespace, 'Pool', poolId);
        var importers = await ktfLib.connection.submitTransaction(viewApprovedImportersTx);
        importers = importers.map(ktfLib.filterAsset)
        await importers.forEach(i => { i.approvedPools = null });
        return importers;
    }
    
    /**
     * Function to get list of all shipments related to financier
     * @async
     * @function listShipments
     * @memberof module:financierLib
     * @instance
     * @returns {Shipment[]} - List of Shipments related to financier
     */
    finLib.listShipments = async function() {
        return await ktfLib.common.submitListShipmentsTx('Financier');
    }

    /**
     * Function to get a particular shipment related to financier
     * @async
     * @function getShipment
     * @memberof module:financierLib
     * @instance
     * @returns {Shipment} - Shipment related to financier
     */
    finLib.getShipment = async function(shipmentId) {
        return await ktfLib.common.submitGetShipmentTx('Financier', shipmentId);
    }

    /**
     * Function to let financier confirm shipment when shipment is first created
     * @async
     * @function confirmShipmentByFinancier
     * @memberof module:financierLib
     * @instance
     * @param {String} shipmentId - Shipment Id
     */
    finLib.confirmShipmentByFinancier = async function(shipmentId) {
        let confirmShipmentByFinancierTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'ConfirmShipmentByFinancier');
        confirmShipmentByFinancierTx.shipment = ktfLib.factory.newRelationship(ktfLib.namespace, 'Shipment', shipmentId);
        await ktfLib.connection.submitTransaction(confirmShipmentByFinancierTx)
            .catch(err => { throw ktfLib.filterError(err) });
    }    

    /**
     * Function to create a underwriting limit of a particular pool
     * @async
     * @function createPoolUnderwritingLimit
     * @memberof module:financierLib
     * @instance
     * @param {String} modelType - Model Type
     * @param {String} modelmodelIdType - Model Id
     * @param {Integer} limitAmount - Limit Amount
     * @param {String} poolId - Pool Id
     * @returns {Shipment} - Shipment relating to Exporter
     * @throws Will throw an error if modelType is not Product, Region, Exporter, Importer
     */
    finLib.createPoolUnderwritingLimit = async function(modelType, modelId, limitAmount, poolId) {
        if (!poolId || poolId == "undefined") {
            throw new Error('Invalid pool ID');
        }
        switch (modelType) {
            case 'Product': case 'Region': case 'Exporter': case 'Importer':
                var settingId = 'lmt_' + Math.floor(Math.random() * 100000);
                var createPoolUnderwritingLimitTx = ktfLib.factory.newTransaction(ktfLib.namespace, 'CreatePoolUnderwritingLimit');
                createPoolUnderwritingLimitTx.settingId = settingId;
                createPoolUnderwritingLimitTx.modelType = modelType;
                createPoolUnderwritingLimitTx.modelId = modelId;
                createPoolUnderwritingLimitTx.pool = ktfLib.factory.newRelationship(ktfLib.namespace, 'Pool', poolId);
                createPoolUnderwritingLimitTx.limitAmount = limitAmount;
                await ktfLib.connection.submitTransaction(createPoolUnderwritingLimitTx)
                    .catch(err => {
                        throw ktfLib.filterError(err);
                    });
                return settingId;
            default:
                throw new Error(`Invalid model type: Expecting one of "Prodcut", "Region", "Exporter", or "Importer". But ${modelType} is detected.`)
        }
    }

    return finLib;
}
