// FirebaseSites

const initializeFirebase = require("./firebaseConfig.js");
const crypto = require('crypto'); // Add this for UUID generation

// Initialize Firebase (asynchronously)
let db;
initializeFirebase()
  .then((firestore) => {
    db = firestore;
    console.log("Firebase Firestore initialized");
  })
  .catch((error) => {
    console.error("Error initializing Firebase:", error);
  });

/**
 * User Management Operations
 */
const userOperations = {
  /**
   * Get or create a user based on wallet address
   * @param {Object} userData - User data containing wallet address
   * @returns {Promise<Object>} User document with ID and data
   */
  getOrCreateUser: async (userData) => {
    try {
      // Check if user exists by wallet address
      const userQuery = await db.collection('users')
        .where('walletAddress', '==', userData.walletAddress)
        .get();

      // If user exists, return existing user data
      if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        return {
          userId: userDoc.id,
          ...userDoc.data()
        };
      }

      // Create new user data
      const newUserData = {
        walletAddress: userData.walletAddress,
        source: 'api',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uuid: crypto.randomUUID()
      };

      // Add new user to collection
      const userRef = await db.collection('users').add(newUserData);

      return {
        userId: userRef.id,
        ...newUserData
      };
    } catch (error) {
      console.error('Error in user management:', error);
      throw new Error('Failed to manage user data: ' + error.message);
    }
  },


  /**
   * Update user data
   * @param {string} userId - User document ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user data
   */
  updateUser: async (userId, updateData) => {
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      const updatedDoc = await userRef.get();
      return {
        userId: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user: ' + error.message);
    }
  }
};

/**
 * Site Management Operations
 */
const siteOperations = {
  /**
   * Create a new site in Firebase
   * @param {Object} siteData - Site information to store
   * @returns {Promise<Object>} Created site data with ID
   */
  createSite: async (siteData) => {
    console.log("Adding website:", siteData);
  
    try {
      // Sanitize subdomain to remove invalid characters
      const sanitizeSubdomain = (input) =>
        input.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  
      let subdomain = sanitizeSubdomain(siteData.subdomain);
  
      // Function to check for subdomain conflicts
      const checkSubdomain = async (subdomain) => {
        const subdomainQuery = await db.collection("sites")
          .where("subdomain", "==", subdomain)
          .get();
        return !subdomainQuery.empty; // True if conflict exists
      };
  
      // Try the initial subdomain
      if (await checkSubdomain(subdomain)) {
        console.log(`Subdomain conflict for: ${subdomain}`);
  
        // Try using the sanitized ticker instead
        subdomain = sanitizeSubdomain(siteData.token.ticker);
        if (await checkSubdomain(subdomain)) {
          console.log(`Subdomain conflict for ticker: ${subdomain}`);
  
          // Combine sanitized name and ticker
          subdomain = sanitizeSubdomain(`${siteData.token.name}-${siteData.token.ticker}`);
          if (await checkSubdomain(subdomain)) {
            console.log(`Subdomain conflict for combined name and ticker: ${subdomain}`);
  
            // Append a random letter to the sanitized ticker
            subdomain = sanitizeSubdomain(`${siteData.token.ticker}-${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`);
            console.log(`Final subdomain attempt: ${subdomain}`);
          }
        }
      }
  
      // Update siteData with the unique subdomain and URLs
      siteData.subdomain = subdomain;
      siteData.url = `https://${subdomain}.x.tokenx.site`;
      siteData.currentUrl = siteData.url;
  
      // Add the site data to the "sites" collection
      const siteRef = await db.collection("sites").add(siteData);
      console.log("Site document created with ID:", siteRef.id);
  
      return siteRef.id;
    } catch (error) {
      console.error("Error creating site:", error);
      throw new Error("Error creating site: " + error.message);
    }
  },
  


  /**
   * Get template data for a site
   * @param {string} templateId - Template identifier
   * @returns {Promise<Object>} Template data or error information
   */
  getTemplateData: async (templateId) => {
    try {
      const templateRef = db.collection('templates').doc(templateId);
      const templateSnapshot = await templateRef.get();

      if (templateSnapshot.exists) {
        return { success: true, templateData: templateSnapshot.data() };
      } else {
        return { success: false, message: 'Template not found' };
      }
    } catch (error) {
      console.error('Error fetching template data:', error);
      return { success: false, message: 'Error fetching template data', error };
    }
  },

  /**
   * Get all sites for a user
   * @param {string} userId - User identifier
   * @returns {Promise<Array>} Array of user's sites
   */
  getUserSites: async (userId) => {
    try {
      const sitesQuery = await db.collection('sites')
        .where('userId', '==', userId)
        .get();

      return sitesQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching user sites:', error);
      throw new Error('Failed to fetch user sites: ' + error.message);
    }
  }
};

// Export the operations as named functions for cleaner imports
module.exports = {
  // User operations
  getOrCreateUser: userOperations.getOrCreateUser,
  updateUser: userOperations.updateUser,

  // Site operations
  createFirebaseSite: siteOperations.createSite,
  getTemplateData: siteOperations.getTemplateData,
  getUserSites: siteOperations.getUserSites
};
