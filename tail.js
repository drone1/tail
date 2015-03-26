/*
 * Tail.js - v1.05
 */

(function( Root, fnFactory ) {

	Root.Tail = fnFactory();

} ( window, function() {
	'use strict';

	function Tail( Options ) {

		this.m_Canvas = document.getElementById( Options.canvas_id );
		this.m_nRootX = Options.root_pos_x !== undefined ? Options.root_pos_x : 0;
		this.m_nRootY = Options.root_pos_y !== undefined ? Options.root_pos_y : this.m_Canvas.height / 2;
		this.m_cSegments = Math.max( 2, Options.segment_count !== undefined ? Options.segment_count : 70 );
		this.m_flTailLengthPercentage = Options.tail_length !== undefined ? Options.tail_length : 0.5;
		this.m_strFillColor = Options.fill_color !== undefined ? Options.fill_color : 'black';
		this.m_strStrokeColor = Options.stroke_color !== undefined ? Options.stroke_color : null;
		this.m_flStrokeWidth = Options.stroke_width !== undefined ? Options.stroke_width : 0;
		this.m_bCollideWithFloor = Options.collide_with_floor !== undefined ? Options.collide_with_floor : true;
		this.m_fnGetBaseAngle = Options.get_base_angle_func !== undefined ? Options.get_base_angle_func : this.GetBaseAngle_DefaultImpl_;
		this.m_fnGetMaxAngle = Options.get_max_angle_func !== undefined ? Options.get_max_angle_func : this.GetMaxAngle_DefaultImpl_;
		this.m_fnGetCurlynessPoints = Options.get_curlyness_points_func !== undefined ? Options.get_curlyness_points_func : this.GetCurlynessPoints_DefaultImpl_;
		this.m_fnGetCurlynessValues = Options.get_curlyness_values_func !== undefined ? Options.get_curlyness_values_func : this.GetCurlynessValues_DefaultImpl_;
		this.m_fnGetTailWidthPoints = Options.get_tail_width_points !== undefined ? Options.get_tail_width_points : this.GetTailWidthPoints_DefaultImpl_;
		this.m_fnGetTailWidthValues = Options.get_tail_width_values !== undefined ? Options.get_tail_width_values : this.GetTailWidthValues_DefaultImpl_;
		this.m_fnFrantic = Options.frantic_func !== undefined ? Options.frantic_func : this.GetFrantic_DefaultImpl_;
		this.m_bAnimate = Options.animate !== undefined ? Options.animate : true;

		this.m_flNoiseBase = Math.random() * 10000;
		this.m_bFirstFrame = true;

		this.m_Noise = new SimplexNoise(); 

	}

	Tail.prototype.BIsVisible = function() {

		var nCanvasTop = CatUtils.GetElementPositionInViewportSpace( this.m_Canvas ).y;
		var nWindowHeight = Math.max( document.documentElement.clientHeight, window.innerHeight || 0 );
		var nScrollPos = window.pageYOffset;

		return !( nCanvasTop > nScrollPos + nWindowHeight ) && !( nCanvasTop + this.m_Canvas.height < 0 );

	}

	Tail.prototype.Render = function() {

		if ( !this.BIsVisible() )
			return;

		var ctx = this.m_Canvas.getContext( '2d' );
		ctx.save();

		var flTime = this.m_bAnimate ? CatUtils.GetTime() : 0;
		var nWidth = this.m_Canvas.width;
		var nHeight = this.m_Canvas.height;
		var bDrawStroke = this.m_strStrokeColor && this.m_strStrokeColor.length && this.m_flStrokeWidth > 1.0;

		ctx.clearRect ( 0 , 0 , nWidth, nHeight );

		var flSegmentLength = nWidth / this.m_cSegments * this.m_flTailLengthPercentage;

		ctx.lineCap = 'round';

		// Make sure these values are sane. We need to do this check every frame since they're dynamic.
		if ( this.m_fnGetCurlynessPoints( flTime ).length !== this.m_fnGetCurlynessValues( flTime ).length ||
			 this.m_fnGetTailWidthPoints( flTime ).length !== this.m_fnGetTailWidthValues( flTime ).length )
		{
			console.error( "Error: These need to be the same size, and both sorted in ascending order." )
		}
		
		var cPasses = bDrawStroke ? 2 : 1;
		for ( var iPass = 0; iPass < cPasses; ++iPass ) {

			var bStrokePass = cPasses > 1 && 0 == iPass;
			var flLastAngle = 0;
	
			// These are used to keep track of the transformation, since we can't access a context's transformation directly.
			var flCurX = this.m_nRootX;
			var flCurY = this.m_nRootY;

			ctx.save();
			ctx.translate( this.m_nRootX, this.m_nRootY );

			for ( var iSegment = 0; iSegment < this.m_cSegments; ++iSegment ) {

				var t = iSegment / this.m_cSegments;
				var flTailWidth = this.GetTailWidth( flTime, t );
				var flNoise = this.m_Noise.noise( this.m_flNoiseBase + 10000 + flTime + t * .5, 100 );	// In [-1,1]
		
				// This is how much we want the given angle to be weighed in, depending on which tail segment we're on. Angles towards the
				// root have a greater influence on the movement.
				var flCurly = this.GetCurlyness( flTime, t );
				var flFrantic = this.m_fnFrantic( flTime, t );
				var flMaxAngle = this.m_fnGetMaxAngle( flTime, t );
				var flAbsoluteAngle = CatUtils.DegreesToRadians( this.m_fnGetBaseAngle( flTime ) ) + flCurly * Math.min( CatUtils.DegreesToRadians( Math.sin( flTime + 2 * Math.PI * t * flNoise * flFrantic ) * flMaxAngle ), flMaxAngle );

				var flNextX = flCurX + flSegmentLength * Math.cos( flAbsoluteAngle );
				var flNextY = flCurY + flSegmentLength * Math.sin( flAbsoluteAngle );

				var bZeroOutAngles = false;
				if ( this.m_bCollideWithFloor && flNextY > this.m_nRootY )
				{
					// This would go through the floor -- adjust. Note that this calculation is a pretty bad approximation
					// and will look better with increasing segment counts.
					flNextY = this.m_nRootY;

					// Zero out angles for the entire rest of the tail for this frame
					bZeroOutAngles = true;
				}

				if ( bZeroOutAngles )
				{
					flAbsoluteAngle = 0;
				}

				var flCurrentAngle = flAbsoluteAngle - flLastAngle;
				flLastAngle = flAbsoluteAngle;

				ctx.rotate( flCurrentAngle );

				var flLineWidth;
				var strStrokeStyle;
				if ( bStrokePass )
				{
					flLineWidth = flTailWidth * this.m_flStrokeWidth;
					strStrokeStyle = this.m_strStrokeColor;
				}
				else
				{
					flLineWidth = flTailWidth;
					strStrokeStyle = this.m_strFillColor;
				}

				ctx.lineWidth = flLineWidth;
				ctx.strokeStyle = strStrokeStyle;
				ctx.beginPath();
				ctx.moveTo( 0, 0 );
				ctx.lineTo( flSegmentLength, 0 );
				ctx.stroke();

				if ( iSegment < this.m_cSegments - 1 )
				{
					ctx.translate( flSegmentLength, 0 );
				}

				flCurX = flNextX;
				flCurY = flNextY;
			}

			ctx.restore();
		}

		ctx.restore();

		this.m_bFirstFrame = false;

	}

	Tail.prototype.GetCurlyness = function( flTime, t ) {

		// Curlyness points and values are dynamic
		var rgCurlynessPoints = this.m_fnGetCurlynessPoints( flTime );
		var rgCurlynessValues = this.m_fnGetCurlynessValues( flTime );

		var i = CatUtils.BinarySearch( t, rgCurlynessPoints );

		return CatUtils.Interpolate(
			t,
			rgCurlynessPoints[ i ],
			rgCurlynessPoints[ i + 1 ],
			rgCurlynessValues[ i ],
			rgCurlynessValues[ i + 1 ]
		);

	}

	Tail.prototype.GetTailWidth = function( flTime, t ) {

		// Tail values are dynamic in case you want to get crazy
		var rgTailWidthPoints = this.m_fnGetTailWidthPoints( flTime );
		var rgTailWidthValues = this.m_fnGetTailWidthValues( flTime );

		var i = CatUtils.BinarySearch( t, rgTailWidthPoints );

		return CatUtils.Interpolate(
			t,
			rgTailWidthPoints[ i ],
			rgTailWidthPoints[ i + 1 ],
			rgTailWidthValues[ i ],
			rgTailWidthValues[ i + 1 ]
		);

	}

	Tail.prototype.LogIfFirstFrame = function( s ) {

			if ( !this.m_bFirstFrame )
				return;

			console.log( s );

	}

	// Private, default implementations for functions
	Tail.prototype.GetBaseAngle_DefaultImpl_ = function( flTime ) { return 0; }
	Tail.prototype.GetMaxAngle_DefaultImpl_ = function( flTime, t ) { return 20; }
	Tail.prototype.GetCurlynessPoints_DefaultImpl_ = function( flTime ) { return [ 0, 0.50, 0.85, 1 ];  }
	Tail.prototype.GetCurlynessValues_DefaultImpl_ = function( flTime ) { return [ 0, 2, 8, 9 ]; }
	Tail.prototype.GetTailWidthPoints_DefaultImpl_ = function( flTime ) { return [ 0, 0.1, 0.8, 1 ]; }
	Tail.prototype.GetTailWidthValues_DefaultImpl_ = function( flTime ) { return [ 45, 40, 25, 15 ]; }
	Tail.prototype.GetFrantic_DefaultImpl_ = function( flTime, t ) { return .03 + t * ( .5 + .5 * Math.sin( .3 * flTime ) ) * .15; }

	return Tail;
}));

// Utils
var CatUtils = {

	GetTime: function() {

		return ( new Date().getTime() / 1000 );

	},

	// This returns the position relative to the viewport, so if Elem is not on screen (above the top of the viewport),
	// the resultant 'y' value will be negative.
	GetElementPositionInViewportSpace: function( Elem ) {

		var xPosition = 0;
		var yPosition = 0;

		while( Elem ) {
			xPosition += ( Elem.offsetLeft - Elem.scrollLeft + Elem.clientLeft );
			yPosition += ( Elem.offsetTop - Elem.scrollTop + Elem.clientTop );
			Elem = Elem.offsetParent;
		}

		return { x: xPosition, y: yPosition };

	},

	Clamp: function( v, min, max ) {

		return Math.max( min, Math.min( max, v ) );

	},

	// Given the input t in the range [a,b], remap to [c,d], smoothly interpolating between c and d with a basic s-curve
	Interpolate: function( t, a, b, c, d ) {

		if ( a == b )
			return t >= b ? d : c;

		var u = CatUtils.Clamp( ( t - a ) / ( b - a ), 0, 1 );
		return c + (d - c) * CatUtils.SCurve( u );

	},

	SCurve: function( t ) {

		var tt = t * t;
		return (3 * tt - 2 * tt * t );

	},

	DegreesToRadians: function( v ) {

		return v * Math.PI / 180;

	},

	BinarySearch: function( t, rgValues ) {
	
		var i = parseInt( rgValues.length / 2 );
		while ( i >= 0 && i < rgValues.length )
		{
			if ( t >= rgValues[i] )
			{
				if ( t <= rgValues[i+1] )
					break;

				++i;

				continue;
			}

			--i;
		}

		return i;

	}


};

var SimplexNoise = (function( r ) {

	var SimplexNoise = function() {
	  this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0], 
	                                 [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1], 
	                                 [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]]; 
	  this.p = [];
	  for (var i=0; i<256; i++) {
		  this.p[i] = Math.floor(Math.random()*256);
	  }
	  // To remove the need for index wrapping, double the permutation table length 
	  this.perm = []; 
	  for(var i=0; i<512; i++) {
			this.perm[i]=this.p[i & 255];
		} 
	
	  // A lookup table to traverse the simplex around a given point in 4D. 
	  // Details can be found where this table is used, in the 4D noise method. 
	  this.simplex = [ 
	    [0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0], 
	    [0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0], 
	    [0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0], 
	    [1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0], 
	    [1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0], 
	    [0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0], 
	    [2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0], 
	    [2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]; 
	};
	
	SimplexNoise.prototype.dot = function(g, x, y) { 
		return g[0]*x + g[1]*y;
	};
	
	SimplexNoise.prototype.noise = function(xin, yin) { 
	  var n0, n1, n2; // Noise contributions from the three corners 
	  // Skew the input space to determine which simplex cell we're in 
	  var F2 = 0.5*(Math.sqrt(3.0)-1.0); 
	  var s = (xin+yin)*F2; // Hairy factor for 2D 
	  var i = Math.floor(xin+s); 
	  var j = Math.floor(yin+s); 
	  var G2 = (3.0-Math.sqrt(3.0))/6.0; 
	  var t = (i+j)*G2; 
	  var X0 = i-t; // Unskew the cell origin back to (x,y) space 
	  var Y0 = j-t; 
	  var x0 = xin-X0; // The x,y distances from the cell origin 
	  var y0 = yin-Y0; 
	  // For the 2D case, the simplex shape is an equilateral triangle. 
	  // Determine which simplex we are in. 
	  var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords 
	  if(x0>y0) {i1=1; j1=0;} // lower triangle, XY order: (0,0)->(1,0)->(1,1) 
	  else {i1=0; j1=1;}      // upper triangle, YX order: (0,0)->(0,1)->(1,1) 
	  // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and 
	  // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where 
	  // c = (3-sqrt(3))/6 
	  var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords 
	  var y1 = y0 - j1 + G2; 
	  var x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords 
	  var y2 = y0 - 1.0 + 2.0 * G2; 
	  // Work out the hashed gradient indices of the three simplex corners 
	  var ii = i & 255; 
	  var jj = j & 255; 
	  var gi0 = this.perm[ii+this.perm[jj]] % 12; 
	  var gi1 = this.perm[ii+i1+this.perm[jj+j1]] % 12; 
	  var gi2 = this.perm[ii+1+this.perm[jj+1]] % 12; 
	  // Calculate the contribution from the three corners 
	  var t0 = 0.5 - x0*x0-y0*y0; 
	  if(t0<0) n0 = 0.0; 
	  else { 
	    t0 *= t0; 
	    n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);  // (x,y) of grad3 used for 2D gradient 
	  } 
	  var t1 = 0.5 - x1*x1-y1*y1; 
	  if(t1<0) n1 = 0.0; 
	  else { 
	    t1 *= t1; 
	    n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1); 
	  }
	  var t2 = 0.5 - x2*x2-y2*y2; 
	  if(t2<0) n2 = 0.0; 
	  else { 
	    t2 *= t2; 
	    n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2); 
	  } 
	  // Add contributions from each corner to get the final noise value. 
	  // The result is scaled to return values in the interval [-1,1]. 
	  return 70.0 * (n0 + n1 + n2); 
	};
	
	// 3D simplex noise 
	SimplexNoise.prototype.noise3d = function(xin, yin, zin) { 
	  var n0, n1, n2, n3; // Noise contributions from the four corners 
	  // Skew the input space to determine which simplex cell we're in 
	  var F3 = 1.0/3.0; 
	  var s = (xin+yin+zin)*F3; // Very nice and simple skew factor for 3D 
	  var i = Math.floor(xin+s); 
	  var j = Math.floor(yin+s); 
	  var k = Math.floor(zin+s); 
	  var G3 = 1.0/6.0; // Very nice and simple unskew factor, too 
	  var t = (i+j+k)*G3; 
	  var X0 = i-t; // Unskew the cell origin back to (x,y,z) space 
	  var Y0 = j-t; 
	  var Z0 = k-t; 
	  var x0 = xin-X0; // The x,y,z distances from the cell origin 
	  var y0 = yin-Y0; 
	  var z0 = zin-Z0; 
	  // For the 3D case, the simplex shape is a slightly irregular tetrahedron. 
	  // Determine which simplex we are in. 
	  var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords 
	  var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords 
	  if(x0>=y0) { 
	    if(y0>=z0) 
	      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; } // X Y Z order 
	      else if(x0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; } // X Z Y order 
	      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; } // Z X Y order 
	    } 
	  else { // x0<y0 
	    if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; } // Z Y X order 
	    else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; } // Y Z X order 
	    else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; } // Y X Z order 
	  } 
	  // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z), 
	  // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and 
	  // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where 
	  // c = 1/6.
	  var x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords 
	  var y1 = y0 - j1 + G3; 
	  var z1 = z0 - k1 + G3; 
	  var x2 = x0 - i2 + 2.0*G3; // Offsets for third corner in (x,y,z) coords 
	  var y2 = y0 - j2 + 2.0*G3; 
	  var z2 = z0 - k2 + 2.0*G3; 
	  var x3 = x0 - 1.0 + 3.0*G3; // Offsets for last corner in (x,y,z) coords 
	  var y3 = y0 - 1.0 + 3.0*G3; 
	  var z3 = z0 - 1.0 + 3.0*G3; 
	  // Work out the hashed gradient indices of the four simplex corners 
	  var ii = i & 255; 
	  var jj = j & 255; 
	  var kk = k & 255; 
	  var gi0 = this.perm[ii+this.perm[jj+this.perm[kk]]] % 12; 
	  var gi1 = this.perm[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]] % 12; 
	  var gi2 = this.perm[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]] % 12; 
	  var gi3 = this.perm[ii+1+this.perm[jj+1+this.perm[kk+1]]] % 12; 
	  // Calculate the contribution from the four corners 
	  var t0 = 0.6 - x0*x0 - y0*y0 - z0*z0; 
	  if(t0<0) n0 = 0.0; 
	  else { 
	    t0 *= t0; 
	    n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0, z0); 
	  }
	  var t1 = 0.6 - x1*x1 - y1*y1 - z1*z1; 
	  if(t1<0) n1 = 0.0; 
	  else { 
	    t1 *= t1; 
	    n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1, z1); 
	  } 
	  var t2 = 0.6 - x2*x2 - y2*y2 - z2*z2; 
	  if(t2<0) n2 = 0.0; 
	  else { 
	    t2 *= t2; 
	    n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2, z2); 
	  } 
	  var t3 = 0.6 - x3*x3 - y3*y3 - z3*z3; 
	  if(t3<0) n3 = 0.0; 
	  else { 
	    t3 *= t3; 
	    n3 = t3 * t3 * this.dot(this.grad3[gi3], x3, y3, z3); 
	  } 
	  // Add contributions from each corner to get the final noise value. 
	  // The result is scaled to stay just inside [-1,1] 
	  return 32.0*(n0 + n1 + n2 + n3); 
	};
	
	return SimplexNoise;
})();

