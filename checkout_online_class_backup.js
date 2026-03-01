<script>
    /*(window.CE_API || (window.CE_API = [])).push(function () {
      CE2.startRecording();
    });*/
/* ==========================================================
     Main Init
  ========================================================== */
document.addEventListener('DOMContentLoaded', function () {
    localStorage.setItem("redirect_url", window.location.href)
    
    var query = window.location.search;
    var urlPar = new URLSearchParams(query);
    var product = urlPar.get('productType') || urlPar.get('producttype') || '';
    var grade_name = urlPar.get('grade_name') || '';
   	var class_detail_id_raw = urlPar.get('class_detail_id') || '';
		var session_detail_id_raw = urlPar.get('session_detail_id') || '';
    var core_product_price = document.getElementById('core_product_price');
    var programCategoryId = "{{wf {"path":"program-id","type":"Number"} }}";
    var rendorCheckoutForm = true;
    /* convert for API */
    var class_detail_id = class_detail_id_raw
      ? toMongoObjectId(class_detail_id_raw)
      : '';

    var session_detail_id = session_detail_id_raw
      ? toMongoObjectId(session_detail_id_raw)
      : '';

    var rendorCheckoutForm = true;

    var signupContainer = document.querySelector('.signup-form-container');
    var checkouterror = document.querySelector('.checkout-error-container');

    var missing = [];


    if (!product) missing.push('productType');
    if (!grade_name || String(grade_name).trim() === '') missing.push('grade_name');
    if (!class_detail_id || String(class_detail_id).trim() === '') missing.push('class_detail_id');
    if (!session_detail_id || String(session_detail_id).trim() === '') missing.push('session_detail_id');

    /* validation using RAW values */
    if (!product) missing.push('productType');
    if (!grade_name.trim()) missing.push('grade_name');
    if (!class_detail_id_raw.trim()) missing.push('class_detail_id');
    if (!session_detail_id_raw.trim()) missing.push('session_detail_id');


    if (missing.length > 0) {

      rendorCheckoutForm = false;

      console.log("Missing params:", missing);

      if (signupContainer) {
        signupContainer.style.display = 'none';
      }

      if (checkouterror) {
        checkouterror.style.display = 'block';
      }

    } else {

      rendorCheckoutForm = true;

      console.log("All params present");

      if (signupContainer) {
        signupContainer.style.display = 'flex'; // safer for Webflow
      }

      if (checkouterror) {
        checkouterror.style.display = 'none';
      }

    }

    setupLoginModalEvents();
		// Class offerings API base for online_class productType

	/* ==========================================================
     Fetch Class Offerings
  ========================================================== */
    

   	async function preloadAllClassOfferings(class_detail_id, session_detail_id) {
      const baseURL = `${_BASE_URL_}/camp/classes/offerings/list?class_detail_id=${encodeURIComponent(class_detail_id)}&session_detail_id=${encodeURIComponent(session_detail_id)}`;

      const res = await fetch(baseURL);
      const data = await res.json();

      return { ok: res.ok, data };
    }

    async function getClassOfferings() {
			
      if (!class_detail_id || !session_detail_id) {
        console.error('Missing or invalid class_detail_id / session_detail_id (need 24-char hex).');
        return;
      }

  		const { ok, data } = await preloadAllClassOfferings(class_detail_id, session_detail_id);
      if (!ok) {
        console.error('Request failed', data);
        return;
      }

      // Top-level keys
      const success = data.success;           // true/false
      const classes = data.classes;           // array of class objects

      if (!data.success || !data.classes || !data.classes.length) {
        console.log('No classes or error:', data.message || data);
        return;
      }

      // First class – all keys
      const cls = data.classes[0];
      const class_detail_id_from_api = cls.class_detail_id;
      const className = cls.className;
      const description = cls.description;
      const price = cls.price;
      const term_name = cls.term_name;
      const schedules = cls.schedules || [];
			
      // text values
      const programText = `${className} (${term_name})`;
      const priceText = `$${price}`;


      // select elements
      var programEls = document.querySelectorAll(
        ".online-program p.dm-sans.font-14.bold"
      );

      var priceEls = document.querySelectorAll(
        ".price-order-details"
      );


      // set program text (both places if multiple)
      programEls.forEach(function(el) {
        el.textContent = programText;
      });


      // set price
      priceEls.forEach(function(el) {
        el.textContent = priceText;
      });
      console.log('Class:', className, term_name, price);
      console.log('Description:', description);

      // Each schedule – all keys
      schedules.forEach(function (schedule) {
        const class_offering_id = schedule.class_offering_id;
        const day = schedule.day;
        const start_time = schedule.start_time;
        const end_time = schedule.end_time;
        const total_spots = schedule.total_spots;
        const enrolled_count = schedule.enrolled_count;
        const available_spots = schedule.available_spots;

        console.log(day, start_time, '-', end_time, '| spots:', available_spots, '/', total_spots);
      });
    }
    getClassOfferings();
		var studentDetails = document.getElementById('student-details');
    var checkoutStudentDetails = document.getElementById('checkout_student_details');
    if (studentDetails && studentDetails.classList.contains('active') && checkoutStudentDetails) {
      checkoutStudentDetails.classList.add('active_checkout_tab');
    }
    
    
    var programStartDate = "";
    var programEndDate = "";
    var residentialProgramDate = "{{wf {"path":"date-residential-ld","type":"PlainText"} }}";
    if (residentialProgramDate.includes(" - ")) {
      var residentialdateParts = residentialProgramDate.split("-");
      if (residentialdateParts.length === 2) {
        programStartDate = residentialdateParts[0].trim();
        programEndDate = residentialdateParts[1].trim();
      } else {
        console.warn("Invalid date format in Residential Date column.");
      }
    } else {
      programStartDate = residentialProgramDate.trim();
      programEndDate = "";
    }
 
    var programDetailId = "{{wf {"path":"program-detail-id","type":"Number"} }}";
    var achAmount = '0';
    var cardAmount = '0';
    var payLaterAmount = '0';

    if (core_product_price) {
      if (product == "commuter" || product == "pf") {
        $(".commuter-order-summary").css("display", "block");
      $(".residential-order-summary").css("display", "none");
      $(".commuter-form").css("display", "block");
      $(".residential-form").css("display", "none");
      $(".checkoutFormComPrice").css("display", "block");
      $(".checkoutFormResPrice").css("display", "none");
      core_product_price.value = '{{wf {"path":"commuter-pf-bank-transfer-price","type":"PlainText"} }}';
      achAmount = '{{wf {"path":"commuter-pf-bank-transfer-price","type":"PlainText"} }}';
      cardAmount = '{{wf {"path":"commuter-pf-credit-card-price","type":"PlainText"} }}';
      payLaterAmount = '{{wf {"path":"commuter-pf-bnpl-price","type":"PlainText"} }}';
      } else {
        $(".commuter-order-summary").css("display", "none");
        $(".residential-order-summary").css("display", "block");
        $(".commuter-form").css("display", "none");
        $(".residential-form").css("display", "block");
        $(".checkoutFormComPrice").css("display", "none");
        $(".checkoutFormResPrice").css("display", "block");
        core_product_price.value = '{{wf {"path":"residential-ld-bank-transfer-price","type":"PlainText"} }}';
        achAmount = '{{wf {"path":"residential-ld-bank-transfer-price","type":"PlainText"} }}';
        cardAmount = '{{wf {"path":"residential-ld-credit-card-price","type":"PlainText"} }}';
        payLaterAmount = '{{wf {"path":"residential-ld-bnpl-price","type":"PlainText"} }}';
      }
    }

    const apiBaseUrl = 'https://3yf0irxn2c.execute-api.us-west-1.amazonaws.com/dev/camp/';

    var memberstack = localStorage.getItem("memberstack");
    var memberstackData = memberstack ? JSON.parse(memberstack) : {};
    var webflowMemberId = (memberstackData.information && memberstackData.information.id) || '';
    var firstName = (memberstackData.information && memberstackData.information['first-name']) || '';
    var lastName = (memberstackData.information && memberstackData.information['last-name']) || '';
    var accountEmail = (memberstackData.email || '');

    var memberData = {
      'name': firstName + ' ' + lastName,
      'email': accountEmail.toLocaleLowerCase(),
      'programId': parseInt(programDetailId, 10),
      'programCategoryId': parseInt(programCategoryId, 10),
      'memberId': webflowMemberId,
      'productType': (product === 'online_class') ? 'online_class' : (product == 'supplementary') ? 'supplementary' : 'core',
      'programName': '{{wf {"path":"name","type":"PlainText"} }}',
      'achAmount': achAmount,
      'cardAmount': cardAmount,
      'payLaterAmount': payLaterAmount,
      'variant_type': 1,
      "site_url": "https://www.nsdebatecamp.com/",
      "slug": "{{wf {"path":"slug","type":"PlainText"} }}",
      "hide_upsell": false, /* In Webflow replace with: {{wf {"path":"hide-upsell","type":"Bool"} }} */
      programStartDate: programStartDate,
      programEndDate: programEndDate,
      isAdmin: true
    };
    console.log(memberData);

    if (product === 'online_class' && rendorCheckoutForm) {
      memberData.grade_name = grade_name || '';
      memberData.class_detail_id = class_detail_id || '';
      memberData.session_detail_id = session_detail_id || '';
    }

    var renderer = "";
    if (rendorCheckoutForm && typeof CheckOutWebflow !== 'undefined') {
      renderer = new CheckOutWebflow(apiBaseUrl, memberData);
    }

    var allTabs = document.getElementsByClassName("checkout-tab-link");
    for (var i = 0; i < allTabs.length; i++) {
      var tab = allTabs[i];
      tab.addEventListener('click', function () {
        var orderDetRes = $(".price-order-details");
        var orderDetCom = $(".price-order-details");

        if (core_product_price) {
          if (this.classList.contains('bank-transfer-tab')) {
            if (product == "commuter" || product == "pf") {
              orderDetCom.html("${{wf {"path":"commuter-pf-bank-transfer-price","type":"PlainText"} }}");
              core_product_price.value = '{{wf {"path":"commuter-pf-bank-transfer-price","type":"PlainText"} }}';
            } else {
              orderDetRes.html("${{wf {"path":"residential-ld-bank-transfer-price","type":"PlainText"} }}");
              core_product_price.value = '{{wf {"path":"residential-ld-bank-transfer-price","type":"PlainText"} }}';
            }
          } else if (this.classList.contains('credit-card-tab')) {
            if (product == "commuter" || product == "pf") {
              orderDetCom.html("${{wf {"path":"commuter-pf-credit-card-price","type":"PlainText"} }}");
              core_product_price.value = '{{wf {"path":"commuter-pf-credit-card-price","type":"PlainText"} }}';
            } else {
              orderDetRes.html("${{wf {"path":"residential-ld-credit-card-price","type":"PlainText"} }}");
              core_product_price.value = '{{wf {"path":"residential-ld-credit-card-price","type":"PlainText"} }}';
            }
          } else if (this.classList.contains('pay-later')) {
            if (product == "commuter" || product == "pf") {
              orderDetCom.html("${{wf {"path":"commuter-pf-bnpl-price","type":"PlainText"} }}");
              core_product_price.value = '{{wf {"path":"commuter-pf-bnpl-price","type":"PlainText"} }}';
            } else {
              orderDetRes.html("${{wf {"path":"residential-ld-bnpl-price","type":"PlainText"} }}");
              core_product_price.value = '{{wf {"path":"residential-ld-bnpl-price","type":"PlainText"} }}';
            }
          }
        }
        var suppProIdE = document.getElementById('suppProIds');
        if (suppProIdE && suppProIdE.value) {
          try {
            var selectedIds = JSON.parse(suppProIdE.value);
            if (selectedIds.length > 0 && renderer && typeof renderer.updateOnlyTotalAmount === 'function') {
              renderer.updateOnlyTotalAmount();
            }
          } catch (e) {}
        }
      }, false);
    }

    $(".checkout-tab-link").removeClass("w--current");
    $(".w-tab-pane").removeClass("w--tab-active");

    if (core_product_price && accountEmail && jQuery && jQuery.fn && jQuery.fn.validate) {
      jQuery("#checkout-form").validate({
        rules: {
          student_email: { notEqual: accountEmail },
          student_email: { checkCurrectEmail: true },
          student_first_name: { notEqualName: firstName }
        }
      });
      jQuery.validator.addMethod("notEqual", function (value, element, param) {
        return this.optional(element) || (value.replace(/\s/g, '').toLowerCase() != param.replace(/\s/g, '').toLowerCase() && value.replace(/\./g, '').toLowerCase() != param.replace(/\./g, '').toLowerCase());
      }, "Parent email should be different than the student email ");
      jQuery.validator.addMethod("notEqualName", function (value, element, param) {
        return this.optional(element) || value.replace(/\s/g, '').toLowerCase() != param.replace(/\s/g, '').toLowerCase();
      }, "Parent name should be different than the student name ");
      jQuery.validator.addMethod("checkCurrectEmail", function (value, element) {
        var regex = /^[a-zA-Z0-9._%+-]+@(yahoo|gmail|hotmail)\.[a-zA-Z]{2,}$/;
        var other_regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
        var match = regex.test(value);
        var other_match = other_regex.test(value);
        if (match) {
          var _regex = /^[a-zA-Z0-9._%+-]+@(yahoo|gmail|hotmail)\.com$/;
          return _regex.test(value);
        } else if (other_match) {
          return true;
        } else {
          return false;
        }
      }, "Please enter a valid email address.");
    }
  });
</script>
<!-- Swiper Slider 2-->
<script>
document.addEventListener('DOMContentLoaded', function () {
     initializeStudentInfoAccordion();
    // Initialize Swiper
   const swiperTwo = new Swiper('.swiper.slider-2', {
        slidesPerView: 3,
        slidesPerGroup: 1,
        speed: 500,
        loop: true,
        autoplay: false,
        allowTouchMove: false,
        navigation: {
           nextEl: '.swiper-btn-next-2', 
           prevEl: '.swiper-btn-prev-2' 
        },
        breakpoints: {
            480: {
                slidesPerView: 3
            }
        }
    });
});



function toMongoObjectId(value) {
  if (value == null) return '';
  var str;
  if (typeof value === 'object' && value && value.$oid) {
    str = String(value.$oid);
  } else {
    str = String(value).trim();
  }
  // Keep only hex characters
  str = str.replace(/[^0-9a-fA-F]/g, '');
  if (str.length === 24) return str;
  if (str.length > 24) return str.slice(-24);  // e.g. "2069a234d478f971c7673835c0" -> last 24
  return str;  // length < 24: return as-is (API will reject; you could return '' instead)
}

// Function to set up login modal open/close behavior
function setupLoginModalEvents() {
console.log("is it working as a click?");
  const loginButton = document.getElementById('loginButton');
  const loginModal = document.getElementById('login-modal');
  const closeModalBtn = document.getElementById('modal-close');
  const modalBg = document.getElementById('login-modal-bg');
  const signupBtnLink = document.getElementById('signup-btn-link');
	console.log(loginModal);
  function showLoginModal() {
    loginModal?.classList.add('show');
  }

  function closeLoginModal() {
    loginModal?.classList.remove('show');
  }

  loginButton?.addEventListener('click', function (e) {
  console.log("is it triggerd to click");
    e.preventDefault();
    showLoginModal();
    console.log("Login Function Called");
  });

  closeModalBtn?.addEventListener('click', function (e) {
    e.preventDefault();
    closeLoginModal();
  });

  modalBg?.addEventListener('click', closeLoginModal);

  signupBtnLink?.addEventListener('click', function (e) {
    e.preventDefault();
    closeLoginModal();
  });
}

function initializeStudentInfoAccordion() {
  const accordions = document.querySelectorAll('.student-info-rounded-accordian');

  accordions.forEach((item, index) => {
    const header = item.querySelector('.student-info-header-wrapper');
    const body = item.querySelector('.student-info-body-content-div');

    header.addEventListener('click', function () {
      
      if (item.classList.contains('open')) {
        item.classList.remove('open');
        body.style.maxHeight = '0';
      } else {
        // Close all other accordions
        accordions.forEach(otherItem => {
          otherItem.classList.remove('open');
          const otherBody = otherItem.querySelector('.student-info-body-content-div');
          if (otherBody) {
            otherBody.style.maxHeight = '0';
          }
        });

        // Open the clicked accordion
        item.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
        //console.log(`Accordion ${index} opened with height:`, body.scrollHeight);
      }
    });
  });
}
</script>
<script>
document.addEventListener("DOMContentLoaded", function () {

    const urlParams = new URLSearchParams(window.location.search);
    const isIframeMode = urlParams.get("iframe") === "true";

    if (isIframeMode) {
        document.body.classList.add("iframe-mode");
    }
});
</script>