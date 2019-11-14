/*
 * /lib/ktflib.js
 * KTF Hyperledger Composer Base Library
*/
'use strict';
// Library imports
const commonLib = require('./ktf_role_lib/common_lib.js');
const adminLib = require('./ktf_role_lib/admin_lib.js');
const connectorLib = require('./ktf_role_lib/connector_lib.js');
const importerLib = require('./ktf_role_lib/importer_lib.js');
const exporterLib = require('./ktf_role_lib/exporter_lib.js');
const finLib = require('./ktf_role_lib/financier_lib.js');
const logLib = require('./ktf_role_lib/logistics_lib.js');
const platLib = require('./ktf_role_lib/platform_lib.js');

// Composer imports
const path = require('path');
const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
// const {FileSystemCardStore, MemoryCardStore} = require('composer-common');
const networkcardStoreManager = require('composer-common').NetworkCardStoreManager;

// Global parameters
let embeddedAdminConnection = undefined;
let embeddedConnectionProfile = { name: 'embedded', 'x-type': 'embedded' };

/**
 * @class ktfLib
 */
class ktfLib {

    /**
     * Function to create a ktf library instance
     * @async
     * @function createConnection
     * @memberof ktfLib
     * @param {String} _cardName - Card Name
     * @param {String} _namespace - Name Space
     * @param {String} _storePath - Store Path
     * @returns {Connection} - Connection Object
     */
    static async createConnection(_cardName = 'admin', _namespace = 'com.kommerce.trade', 
                           _storePath = 'deploy/.composer/cards') {
        let conn = new ktfLib();

        //define credentials
        conn.userName = _cardName;
        conn.cardName = _cardName + '@ktf-trade-net';
        conn.namespace = _namespace;
        conn.assetRegistries = {};
        conn.participantRegistries = {};

        if (embeddedAdminConnection == undefined) {
            //real fabric network
            //create filesystem cardstore
            conn.cardStore = networkcardStoreManager.getCardStore({ type: 'composer-wallet-filesystem', storePath: process.env.HOME+'/.composer' })

            //get connection profile from cardstore
            return conn.cardStore.get(conn.cardName)
            .then(function (card) {
                conn.connectionProfile = card.getConnectionProfile();

                //create business network connection
                conn.connection = new BusinessNetworkConnection({ cardStore: conn.cardStore });
                return conn.connection.connect(conn.cardName);
            }).then(function (conn2) {
                //create asset factory
                conn.factory = conn.connection.getBusinessNetwork().getFactory();

                // Assign required imported library according to connection object
                //ktfLib.prototype.admin = new adminLib(conn);
                assignLibrary(_cardName, conn);
                
                return Promise.resolve(conn);
            });
        } else {
            //embedded network
            conn.cardStore = embeddedAdminConnection.cardStore;
            conn.connectionProfile = embeddedConnectionProfile;

            conn.connection = new BusinessNetworkConnection({ cardStore: conn.cardStore });
            await conn.connection.connect(conn.cardName);

            conn.factory = conn.connection.getBusinessNetwork().getFactory();

            // Assign required imported library according to connection object
            //ktfLib.prototype.admin = new adminLib(conn);
            assignLibrary(_cardName, conn);
            
            return Promise.resolve(conn);
        }
    }

    /**
     * Function to create a ktf library instance using an embedded connection
     * @async
     * @function createEmbeddedNetwork
     * @memberof ktfLib
     * @param {String} _cardName - Card Name
     * @param {String} _namespace - Name Space
     * @returns {Connection} - Connection Object
     */
    static async createEmbeddedNetwork(_cardName = 'admin', _namespace = 'com.kommerce.trade') {

        let conn = new ktfLib();
        // const cardStore = new MemoryCardStore();
        const cardStore = networkcardStoreManager.getCardStore({ type: 'composer-wallet-inmemory' })
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        const deployerCardName = 'PeerAdmin' + '@ktf-trade-net';   //channel admin(deploy)
        const adminUserName = _cardName;                           //biz network admin

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: ['PeerAdmin', 'ChannelAdmin']
        };
        const deployerCard = new IdCard(deployerMetadata, embeddedConnectionProfile);
        // deployerCard.setCredentials({ certificate: 'cert', privateKey: 'key' });
        deployerCard.setCredentials(credentials);

        //create admin connection for deployment
        embeddedAdminConnection = new AdminConnection({ cardStore: cardStore });
        await embeddedAdminConnection.importCard(deployerCardName, deployerCard);
        await embeddedAdminConnection.connect(deployerCardName);

        // Install the Composer runtime for the new business network
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(
            path.resolve(__dirname, '..', 'composer-bna'));
        await embeddedAdminConnection.install(businessNetworkDefinition);

        // Start the business network and configure an network admin identity(adminUserName)
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await embeddedAdminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);

        // Import the network admin identity for us to use
        let adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await embeddedAdminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        //create new embedded connection
        return await this.createConnection(adminUserName);
    }

    /**
     * Function to disconnect connection
     * @async
     * @function disconnect
     * @memberof ktfLib
     * @instance
     */
    async disconnect() {
        await this.connection.disconnect();
    }

    /* Utility Functions */

    /**
     * Function to get all Participants based on type
     * @async
     * @function disconnect
     * @memberof ktfLib
     * @instance 
     * @param {String} _participantType - Participant Type
     * @returns {Participant[]} - List of Participants based on type
     */
    async getParticipants(_participantType) {
        //get asset registry (caching)
        if (this.participantRegistries[_participantType] == undefined)
            this.participantRegistries[_participantType] = await this.connection.getParticipantRegistry(this.namespace + "." + _participantType);

        let allParticipants = await this.participantRegistries[_participantType].getAll();
        return allParticipants.map(this.filterParticipant);
    }

   /**
     * Function to create a vanilla JS object from a composer participant object
     * @async
     * @function filterParticipant
     * @memberof ktfLib
     * @instance
     * @param {Object} composerParticipantObj - Composer Participant object
     * @returns {Object} - JS Object
     */
    filterParticipant(composerParticipantObj) {
        let asset = {};
        for (let key in composerParticipantObj) {
            if ((key[0] != '$') && (key != 'ParticipantDeclaration') && !(composerParticipantObj[key] instanceof Array)) {
                if (composerParticipantObj[key].$class == 'Relationship') {
                    asset[key] = composerParticipantObj[key].$identifier;
                } else {
                    asset[key] = composerParticipantObj[key];
                }
            }
        }
        return asset;
    }

   /**
     * Function to issue credential card(card userid:userId) for a *created* participant
     * @async
     * @function filterParticipant
     * @memberof ktfLib
     * @instance
     * @param {Object} composerParticipantObj - Composer Participant object
     * @returns {Object} - JS Object
     */
    async issueParticipant(_participantObj, _userId) {
        let self = this;
        let fullUserId = _userId + "@ktf-trade-net";
        let identityIssue = false;

        // Give platform participant access to issue identities
        switch(_participantObj.$type) {
            case 'Platform':
                identityIssue = true;
                break;
            case 'Importer':
            case 'Exporter':
            case 'Financier':
            case 'Logistics':
            case 'Inspector':
                identityIssue = false;
                break;
        }

        await this.connection.issueIdentity(_participantObj, fullUserId, {issuer:identityIssue})
            .then(function (credentials) {
                const meta = {
                    version: 1,
                    userName: fullUserId,
                    enrollmentSecret: credentials.userSecret,
                    businessNetwork: 'ktf-trade-net'
                };
                const card = new IdCard(meta, self.connectionProfile);
                return self.cardStore.put(fullUserId, card);
            }).then(function () {
                return self.cardStore.getAll();
            }).then(function (rsl) {
            });
    }

   /**
     * Function to get all assets by type
     * @async
     * @function getAssets
     * @memberof ktfLib
     * @instance
     * @param {String} _assetType - Asset Type
     * @returns {Asset[]} - List of Assets of given type
     */
    async getAssets(_assetType) {
        //get asset registry (caching)
        if (this.assetRegistries[_assetType] == undefined)
            this.assetRegistries[_assetType] = await this.connection.getAssetRegistry(this.namespace + "." + _assetType);

        let allAssets = await this.assetRegistries[_assetType].getAll();
        return allAssets.map(this.filterAsset);
    }

    /**
     * Function to get a particular Asset
     * @async
     * @function getAsset
     * @memberof ktfLib
     * @instance
     * @param {String} _assetType - Asset Type
     * @param {String} _assetId - Asset Id
     * @returns {Asset} - Asset
     */
    async getAsset(_assetType, _assetId) {
        //get asset registry (caching)
        if (this.assetRegistries[_assetType] == undefined)
            this.assetRegistries[_assetType] = await this.connection.getAssetRegistry(this.namespace + "." + _assetType);

        return this.filterAsset(await this.assetRegistries[_assetType].get(_assetId));
    }

    /**
     * Function to update an Asset
     * @async
     * @function updateAsset
     * @memberof ktfLib
     * @instance
     * @param {String} _assetType - Asset Type
     * @param {String} _assetId - Asset Id
     * @param {Asset} _assetObj - Asset Object
     * @returns {Asset} - Asset
     */
    async updateAsset(_assetType, _assetId, _assetObj) {
        //get asset registry (caching)
        if (this.assetRegistries[_assetType] == undefined)
            this.assetRegistries[_assetType] = await this.connection.getAssetRegistry(this.namespace + "." + _assetType);

        let asset = await this.assetRegistries[_assetType].get(_assetId);
        for (let key in _assetObj) {
            asset[key] = _assetObj[key];
        }

        return this.filterAsset(await this.assetRegistries[_assetType].update(asset));
    }

   /**
     * Function to create a vanilla JS object from a composer asset object
     * @async
     * @function filterAsset
     * @memberof ktfLib
     * @instance
     * @param {Asset} composerAssetObj - Asset Object
     * @returns {Asset} - JS Object
     */
    filterAsset(composerAssetObj) {
        let asset = {};
        for (let key in composerAssetObj) {
            if ((key[0] != '$') && (key != 'AssetDeclaration')) {
                if (composerAssetObj[key].$class == 'Relationship') {
                    asset[key] = composerAssetObj[key].$identifier;
                } else {
                    asset[key] = composerAssetObj[key];
                }
            }
        }
        return asset;
    }

   /**
     * Function to remove redundent Error Message from Composer Runtime
     * @async
     * @function filterError
     * @memberof ktfLib
     * @instance
     * @param {String} err - Errpr Message
     * @returns {Error} - Error
     */
    filterError(err) {
        var reg = /transaction returned with failure:.*/
        var reg2 = /Error:.*/
        var msg = err.message;
        if (reg.test(msg)) {
            // MODE=deoloy
            msg = reg.exec(msg);
            msg = reg2.exec(msg);
            return new Error(msg[0]);
        } else {
            // MODE=embedded
            return new Error(msg);
        }
    }
    
    /*
     * Composer's event listener functions
    */ 

   /**
     * Function to listen to composer state change events
     * @async
     * @function listenStateChangeEvent
     * @memberof ktfLib
     * @instance
     * @param {String} callBack - Callback
     */
    async listenStateChangeEvent(callBack) {
        await this.connection.on('event', (event) => {
            //console.log(event);
            //if('state' in event)
            if(event['$type'] == 'StateChangeEvent')
              callBack(event.shipment.$identifier, event.state);
        });
    }

    /**
     * Function to listen to composer pending state change events
     * @async
     * @function listenPendingChangeEvent
     * @memberof ktfLib
     * @instance
     * @param {String} callBack - Callback
     */
    async listenPendingChangeEvent(callBack) {
        await this.connection.on('event', (event) => {
            //console.log(event);
            //if('nextState' in event)
            if(event['$type'] == 'PendingChangeEvent')
              callBack(event.shipment.$identifier, event.currState, event.nextState);
        });
    }
}

/**
     * Function to assign the necessary libraries to the composer connection
     * @async
     * @function assignLibrary
     * @memberof ktfLib
     * @instance
     * @param {String} card_name - Card Name
     * @param {Object} conn - Connection
     */
function assignLibrary(card_name, conn) {
    let role = card_name.split('_')[0]; // Extract the type of composer connection from card name (Eg. "admin"=admin, "I"=importer)

    switch(role) {
        case 'admin':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.admin = adminLib(conn);
            break;
        case 'connector':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.connector = connectorLib(conn);
            break;
        case 'I':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.importer = importerLib(conn);
            break;
        case 'E':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.exporter = exporterLib(conn);
            break;
        case 'F':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.fin = finLib(conn);
            break;
        case 'L':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.log = logLib(conn);
            break;
        case 'P':
            ktfLib.prototype.common = commonLib(conn);
            ktfLib.prototype.plat = platLib(conn);
            ktfLib.prototype.admin = adminLib(conn);
            break;
        case 'IN1':
        case 'IN2':
            ktfLib.prototype.common = commonLib(conn);
            break;
    }         
}

module.exports = ktfLib;