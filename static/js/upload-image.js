$(document).ready( function() {
	$(document).on('change', '.btn-file :file', function() {
	var input = $(this),
		label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
	input.trigger('fileselect', [label]);
	});

	$('.btn-file :file').on('fileselect', function(event, label) {
	    
	    var input = $(this).parents('.input-group').find(':text'),
	        log = label;
	    
	    if( input.length ) {
	        input.val(log);
	    } else {
	        if( log ) alert(log);
	    }
    
	});
	function readURL(input, selector) {
	    if (input.files && input.files[0]) {
	        var reader = new FileReader();
	        
	        if(selector == 1){
	        	reader.onload = function (e) {
		            $('#img-upload').attr('src', e.target.result);
		        }
	        }
	        else{
	        	reader.onload = function (e) {
		            $('#digital-sign-upload').attr('src', e.target.result);
		        }
	        }        
	        reader.readAsDataURL(input.files[0]);
	    } 
	}

	$("#imgInp").change(function(){
	    readURL(this, 1);
	}); 	
	$("#digitalSignInp").change(function(){
	    readURL(this, 2);
	}); 
});