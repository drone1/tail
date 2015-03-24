window.onload = function() {

	var strCanvasID = 'Tail';
	var Canvas = document.getElementById( strCanvasID );
	var nMiddleX = Canvas.width / 2;
	var nMiddleY = Canvas.height / 2;

	var TailRenderer = new Tail( {
		canvas_id: strCanvasID,
		root_pos_x: nMiddleX / 4,
		root_pos_y: nMiddleY,
		tail_length: 0.40,	// Percentage of width
		base_angle: 0,	// Offset for all angles
		segment_count: 50,	// The more of these, the more costly tail.js will be, performance-wise
		fill_color: '#000',
		//stroke_color: '#222',	// Draw a stroke around the tail
		//stroke_width: 1.2,	// Percentage of the current tail segment's width
		collide_with_floor: true,	// Don't go below the root y plane
		animate: true,	// Set this to false to disable animation

		get_max_angle_func: function( flTime, t ) {
			return 20;
		},

		get_curlyness_points_func: function( flTime ) {

			// Percentages along the tail
			return [ 0, 0.50, 0.85, 1 ];

		},

		get_curlyness_values_func: function( flTime ) {

			// Corresponding values for each respective curlyness point along the tail
			return [ 0, 2, 8, 9 ];

		},

		get_tail_width_points: function( flTime ) {

			// Percentages along the tail
			return [ 0, 0.1, 0.80, 1 ];

		},

		get_tail_width_values: function( flTime ) {

			// Corresponding values for each respective width point along the tail
			return [ 45, 40, 25, 15 ];

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
