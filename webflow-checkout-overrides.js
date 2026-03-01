/**
 * Webflow checkout overrides
 * Load this AFTER the main checkout script (checkout_with_abandoned_onlineclass.js).
 * Edit this file in Webflow custom code to change behavior without waiting for CDN.
 * The main script must load first (e.g. in Footer Code or before this embed).
 */

(function () {
  'use strict';

  // Wait for the main checkout class to be available (in case scripts load async)
  function applyOverrides() {
    if (typeof CheckOutWebflow === 'undefined') {
      setTimeout(applyOverrides, 50);
      return;
    }

    var Proto = CheckOutWebflow.prototype;

    // --- Example: override a method (uncomment and edit as needed) ---
    /*
    Proto.updateOldStudentList = function () {
      // Your custom implementation
      console.log('My custom updateOldStudentList');
      // Call original if needed:
      // BriefsUpsellModal.prototype.updateOldStudentList.call(this);
    };
    */

    // --- Run after checkout init: sync student-details tab with content panel ---
    var OriginalRender = Proto.renderPortalData;
    if (OriginalRender) {
      Proto.renderPortalData = function () {
        var promise = OriginalRender.apply(this, arguments);
        function syncStudentDetailsTab() {
          var studentDetails = document.getElementById('student-details');
          var checkoutStudentDetails = document.getElementById('checkout_student_details');
          if (studentDetails && studentDetails.classList.contains('active') && checkoutStudentDetails) {
            checkoutStudentDetails.classList.add('active_checkout_tab');
          }
        }
        if (promise && typeof promise.then === 'function') {
          promise.then(syncStudentDetailsTab).catch(function () {});
        } else {
          syncStudentDetailsTab();
        }
        return promise;
      };
    }

    // Add more overrides below. Examples:
    // Proto.activateDiv = function(divId) { ... };
    // Proto.displayStudentInfo = function(display) { ... };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOverrides);
  } else {
    applyOverrides();
  }
})();
