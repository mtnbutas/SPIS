$(document).on("ready",function(){
    $('.container').css({'height': window.innerHeight + 'px'});
});
$(window).on("resize",function(){
    $('.container').css({'height': window.innerHeight + 'px'});
});