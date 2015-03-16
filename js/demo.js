window.onload = function() {

	var strCanvasID = 'Tail';
	var Canvas = document.getElementById( strCanvasID );
	var nMiddleX = Canvas.width / 2;
	var nMiddleY = Canvas.height / 2;

	var TailRenderer = new Tail( {
		canvas_id: strCanvasID,
		root_pos_x: nMiddleX / 4,
		root_pos_y: nMiddleY,
		tail_length: 0.4,	// Percentage of width
		base_angle: 0,	// Offset for all angles
		segment_count: 50,
		max_angle: 20,
		fill_color: '#000',
		collide_with_floor: true,

		get_curlyness_points_func: function( flTime ) {

			// Percentages along the tail
			return [ 0, 0.50, 0.85, 1 ];

		},

		get_curlyness_values_func: function( flTime ) {

			// Corresponding values for each respective curlyness point along the tail
			return [ 0, 2, 8, 5 ];

		},

		get_tail_width_points: function( flTime ) {

			return [ 0, 0.8, 1 ];

		},


		get_tail_width_values: function( flTime ) {

			return [ 45, 25, 12 ];

		},

		frantic_func: function( flTime, t ) {

			return 1 * .15;

		}

	} );

	function Think() {

		TailRenderer.Render();

		BlinkThink();

		window.requestAnimationFrame( Think );

	}

	function BlinkThink() {

		this.flNextBlinkTime_ = this.flNextBlinkTime_ || 0;
		this.EyeDivElem_ = this.EyeDivElem_ || document.getElementById( 'Eye' );

		var flTime = CatUtils.GetTime();
		if ( this.flNextBlinkTime_ <= flTime )
		{
			// Blink now
			this.EyeDivElem_.style.display = 'block';
			var nBlinkDuration = 200;
			var This = this;
			setTimeout(
				function()
				{
					This.EyeDivElem_.style.display = 'none';
				},
				nBlinkDuration
			);
	
			// Schedule next blink
			this.flNextBlinkTime_ = flTime + 2.5 + Math.random() * 5.0;
		}
	}

	window.requestAnimationFrame( Think );

}
