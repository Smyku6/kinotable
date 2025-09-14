(function( $ ) {
	'use strict';

	/**
	 * Hide all blocks depending from $blocks[index] recursively.
	 * @param {*}  
	 */
	function hideDependentBlocks(index) {
		var $children = $('.msfp-block-conditional[data-prec-block-id=' + index + ']');
		$children.each(function(i, element) {
			var $child = $(element);
			$child.slideUp("fast");
			hideDependentBlocks($('.fw-step-block').index($child));
		});
	}

	function prepareConditionals() {
		var $blocks = $('.fw-step-block:not(.msfp-block-conditional)');
		$('.msfp-block-conditional').each(function(index, element) {
			var $block = $(element);
			var precBlockIndex = $block.attr('data-prec-block-id');
			var precBlock = $blocks[precBlockIndex];
			var precBlockType = $(precBlock).attr('data-type');		
			var precOp = $block.attr('data-prec-op');
			var precValue = $block.attr('data-prec-value');
			var visible = $block.attr('data-visible');
			
			// set event handlers for precondition input fields
			var evaluate = function(event){
				console.log("EVALUATING " + $(event.target).val() + " " + precOp + ' ' + precValue);
				console.log(event.target);
				var reveal = false;
				// evaluate conditions and show/hide the conditional block $block
				switch (precOp) {
					case 'eq':
						if (precBlockType === 'fw-date') {
							var date = new Date(precValue);
							var inputDate = new Date($(event.target).val());
							reveal = date.getTime() === inputDate.getTime();
						} else if (precBlockType === 'fw-radio') {
							if ($(event.target).attr('type') === 'checkbox') {
								if ($(event.target).next('label').text() === precValue) {
									reveal = event.target.checked;
								} else {
									// We are not interested in this checkbox.
									return;
								}
							} else {
								reveal = $(event.target).next('label').text() === precValue;
							}
						} else {
							reveal = $(event.target).val() === precValue;							
						}
						break;
					case 'fi':
						reveal = $(event.target).val() !== '';
						break;
					case 'lt':
						if (precBlockType === 'fw-date') {
							var date = new Date(precValue);
							var inputDate = new Date($(event.target).val());
							reveal = date.getTime() > inputDate.getTime();
						} else if (precBlockType === 'fw-numeric') {
							var targetNumber = parseInt(precValue);
							var inputNumber = parseInt($(event.target).val());
							reveal = inputNumber < targetNumber;
						}
						break;
					case 'gt':
						if (precBlockType === 'fw-date') {
							var date = new Date(precValue);
							var inputDate = new Date($(event.target).val());
							reveal = date.getTime() < inputDate.getTime();
						} else if (precBlockType === 'fw-numeric') {
							var targetNumber = parseInt(precValue);
							var inputNumber = parseInt($(event.target).val());
							reveal = inputNumber > targetNumber;
						}
						break;
				}
				//console.log("EVALUATED as " + reveal);
				if (visible === 'hide') {
					reveal = !reveal;
				}
				if (reveal) {
					$block.slideDown("fast");
				} else {
					$block.slideUp("fast");
					// hide all blocks depending from this block
					hideDependentBlocks($blocks.index($block.find('.fw-step-block:not(.msfp-block-conditional)')));
				}
			}; // end evaluate 

			switch (precBlockType) {
				case 'fw-date':
				case 'fw-radio':
					$(precBlock).find('input').on("change", evaluate);
					break;
				case 'fw-select':
					$(precBlock).find('select').on("change", evaluate);
					break;
				default:
					$(precBlock).find('input, textarea').focusout(evaluate);				
					break;	
			}
						
			// initial show or hide conditionals
			if (visible === 'show') {
				$block.hide();
			} else if (visible === 'hide') {
				$block.show();
			}
		});
	}


	$( document ).ready(function() {
		/* Allow skipping registration if user is logged in */
		if ($('.msfp-loggedin')) {
			$('.msfp-loggedin').closest('.fw-step-block').attr('data-required', false);
		}
		prepareConditionals();
	});

})( jQuery );
