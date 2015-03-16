(function( Root, fnFactory ) {

	Root.Tail = fnFactory();

} ( this, function() {
	'use strict';

	function Tail( Options ) {

		this.m_Canvas = document.getElementById( Options.canvas_id );
		this.m_nRootX = Options.root_pos_x;
		this.m_nRootY = Options.root_pos_y;
		this.m_flBaseAngle = CatUtils.DegreesToRadians( Options.base_angle );
		this.m_cSegments = Math.max( 2, Options.segment_count );
		this.m_flTailLengthPercentage = Options.tail_length;
		this.m_flMaxAngle = Options.max_angle;
		this.m_strFillColor = Options.fill_color;
		this.m_flStartWidth = Options.start_width;
		this.m_flEndWidth = Options.end_width;
		this.m_fnGetTailWidthPoints = Options.get_tail_width_points;
		this.m_fnGetTailWidthValues = Options.get_tail_width_values;
		this.m_bCollideWithFloor = Options.collide_with_floor;
		this.m_fnGetCurlynessPoints = Options.get_curlyness_points_func;
		this.m_fnGetCurlynessValues = Options.get_curlyness_values_func;
		this.m_fnFrantic = Options.frantic_func;

		this.m_flNoiseBase = Math.random() * 10000;
		this.m_bFirstFrame = true;

		this.m_Noise = new SimplexNoise(); 

	}

	Tail.prototype.Render = function() {

		var ctx = this.m_Canvas.getContext( '2d' );
		ctx.save();

		var flTime = CatUtils.GetTime();
		var nWidth = this.m_Canvas.width;
		var nHeight = this.m_Canvas.height;

		ctx.clearRect ( 0 , 0 , nWidth, nHeight );

		var flSegmentLength = nWidth / this.m_cSegments * this.m_flTailLengthPercentage;

		ctx.beginPath();
		ctx.lineCap = 'round';
		ctx.translate( this.m_nRootX, this.m_nRootY );
		ctx.strokeStyle = this.m_strFillColor;

		// These are used to keep track of the transformation, since we can't access a context's transformation directly.
		var flCurX = this.m_nRootX;
		var flCurY = this.m_nRootY;

		var flLastAngle = 0;

		// Make sure these values are sane. We need to do this check every frame since they're dynamic.
		if ( this.m_fnGetCurlynessPoints( flTime ).length !== this.m_fnGetCurlynessValues( flTime ).length ||
			 this.m_fnGetTailWidthPoints( flTime ).length !== this.m_fnGetTailWidthValues( flTime ).length )
		{
			console.log( "Error: These need to be the same size, and both sorted in ascending order." )
		}
		
		for ( var i = 0; i < this.m_cSegments; ++i )
		{
			var t = i / this.m_cSegments;

			var flNoise = this.m_Noise.noise( this.m_flNoiseBase + 10000 + flTime + t * .5, 100 );	// In [-1,1]
	
			// This is how much we want the given angle to be weighed in, depending on which tail segment we're on. Angles towards the
			// root have a greater influence on the movement.
			var flCurly = this.GetCurlyness( flTime, t );
			var flFrantic = this.m_fnFrantic( flTime, t );
			var flAbsoluteAngle = this.m_flBaseAngle + flCurly * CatUtils.DegreesToRadians( Math.sin( flTime + 2 * Math.PI * t * flNoise * flFrantic ) * this.m_flMaxAngle );

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

			ctx.lineWidth = this.GetTailWidth( t );

			ctx.moveTo( 0, 0 );
			ctx.lineTo( flSegmentLength, 0 );

			ctx.stroke();
			ctx.closePath();

			if ( i < this.m_cSegments - 1 )
			{
				ctx.translate( flSegmentLength, 0 );
			}

			flCurX = flNextX;
			flCurY = flNextY;
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

	Tail.prototype.GetTailWidth = function( t ) {

		// Tail values are dynamic in case you want to get crazy
		var rgTailWidthPoints = this.m_fnGetTailWidthPoints( t );
		var rgTailWidthValues = this.m_fnGetTailWidthValues( t );

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

	return Tail;
}));

// Utils
var CatUtils = {

	GetTime: function() {

		return ( new Date().getTime() / 1000 );

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

