var SGDevice=(()=>{var sa=Object.defineProperty;var _h=Object.getOwnPropertyDescriptor;var xh=Object.getOwnPropertyNames;var vh=Object.prototype.hasOwnProperty;var yh=(i,t)=>{for(var e in t)sa(i,e,{get:t[e],enumerable:!0})},Mh=(i,t,e,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of xh(t))!vh.call(i,s)&&s!==e&&sa(i,s,{get:()=>t[s],enumerable:!(n=_h(t,s))||n.enumerable});return i};var Sh=i=>Mh(sa({},"__esModule",{value:!0}),i);var a0={};yh(a0,{createDevice:()=>r0});var ll="170";var bh=0,Il=1,Eh=2;var kc=1,cl=2,bn=3,Gn=0,He=1,Tn=2,dn=0,Bi=1,_r=2,Pl=3,Ll=4,Th=5,si=100,wh=101,Ah=102,Rh=103,Ch=104,Ih=200,Ph=201,Lh=202,Dh=203,Ba=204,za=205,Uh=206,Nh=207,Fh=208,Oh=209,Bh=210,zh=211,kh=212,Hh=213,Vh=214,ka=0,Ha=1,Va=2,Vi=3,Ga=4,Wa=5,Xa=6,qa=7,Hc=0,Gh=1,Wh=2,Vn=0,hl=1,ul=2,dl=3,Fs=4,Xh=5,fl=6,pl=7;var Vc=300,Gi=301,Wi=302,Ya=303,Za=304,Yr=306,_s=1e3,An=1001,$a=1002,Ye=1003,qh=1004;var Hs=1005;var Le=1006,ra=1007;var Hn=1008;var In=1009,Gc=1010,Wc=1011,xs=1012,ml=1013,oi=1014,qe=1015,Ue=1016,gl=1017,_l=1018,Xi=1020,Xc=35902,qc=1021,Yc=1022,on=1023,Zc=1024,$c=1025,zi=1026,qi=1027,Jc=1028,xl=1029,Kc=1030,vl=1031;var yl=1033,dr=33776,fr=33777,pr=33778,mr=33779,Ja=35840,Ka=35841,Qa=35842,ja=35843,to=36196,eo=37492,no=37496,io=37808,so=37809,ro=37810,ao=37811,oo=37812,lo=37813,co=37814,ho=37815,uo=37816,fo=37817,po=37818,mo=37819,go=37820,_o=37821,gr=36492,xo=36494,vo=36495,Qc=36283,yo=36284,Mo=36285,So=36286;var xr=2300,bo=2301,aa=2302,Dl=2400,Ul=2401,Nl=2402;var Yh=3200,Zh=3201;var jc=0,$h=1,kn="",Ie="srgb",qn="srgb-linear",Zr="linear",le="srgb";var Mi=7680;var Fl=519,Jh=512,Kh=513,Qh=514,th=515,jh=516,tu=517,eu=518,nu=519,Ol=35044;var Bl="300 es",Rn=2e3,vr=2001,Wn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;let n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;let s=this._listeners[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;let n=this._listeners[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}},Re=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],zl=1234567,us=Math.PI/180,vs=180/Math.PI;function gi(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Re[i&255]+Re[i>>8&255]+Re[i>>16&255]+Re[i>>24&255]+"-"+Re[t&255]+Re[t>>8&255]+"-"+Re[t>>16&15|64]+Re[t>>24&255]+"-"+Re[e&63|128]+Re[e>>8&255]+"-"+Re[e>>16&255]+Re[e>>24&255]+Re[n&255]+Re[n>>8&255]+Re[n>>16&255]+Re[n>>24&255]).toLowerCase()}function be(i,t,e){return Math.max(t,Math.min(e,i))}function Ml(i,t){return(i%t+t)%t}function iu(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function su(i,t,e){return i!==t?(e-i)/(t-i):0}function ds(i,t,e){return(1-e)*i+e*t}function ru(i,t,e,n){return ds(i,t,1-Math.exp(-e*n))}function au(i,t=1){return t-Math.abs(Ml(i,t*2)-t)}function ou(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function lu(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function cu(i,t){return i+Math.floor(Math.random()*(t-i+1))}function hu(i,t){return i+Math.random()*(t-i)}function uu(i){return i*(.5-Math.random())}function du(i){i!==void 0&&(zl=i);let t=zl+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function fu(i){return i*us}function pu(i){return i*vs}function mu(i){return(i&i-1)===0&&i!==0}function gu(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function _u(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function xu(i,t,e,n,s){let r=Math.cos,a=Math.sin,o=r(e/2),l=a(e/2),c=r((t+n)/2),h=a((t+n)/2),u=r((t-n)/2),d=a((t-n)/2),p=r((n-t)/2),g=a((n-t)/2);switch(s){case"XYX":i.set(o*h,l*u,l*d,o*c);break;case"YZY":i.set(l*d,o*h,l*u,o*c);break;case"ZXZ":i.set(l*u,l*d,o*h,o*c);break;case"XZX":i.set(o*h,l*g,l*p,o*c);break;case"YXY":i.set(l*p,o*h,l*g,o*c);break;case"ZYZ":i.set(l*g,l*p,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Ni(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Ne(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}var Sl={DEG2RAD:us,RAD2DEG:vs,generateUUID:gi,clamp:be,euclideanModulo:Ml,mapLinear:iu,inverseLerp:su,lerp:ds,damp:ru,pingpong:au,smoothstep:ou,smootherstep:lu,randInt:cu,randFloat:hu,randFloatSpread:uu,seededRandom:du,degToRad:fu,radToDeg:pu,isPowerOfTwo:mu,ceilPowerOfTwo:gu,floorPowerOfTwo:_u,setQuaternionFromProperEuler:xu,normalize:Ne,denormalize:Ni},it=class i{constructor(t=0,e=0){i.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(be(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Qt=class i{constructor(t,e,n,s,r,a,o,l,c){i.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c)}set(t,e,n,s,r,a,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],g=n[8],M=s[0],m=s[3],f=s[6],E=s[1],S=s[4],x=s[7],O=s[2],R=s[5],I=s[8];return r[0]=a*M+o*E+l*O,r[3]=a*m+o*S+l*R,r[6]=a*f+o*x+l*I,r[1]=c*M+h*E+u*O,r[4]=c*m+h*S+u*R,r[7]=c*f+h*x+u*I,r[2]=d*M+p*E+g*O,r[5]=d*m+p*S+g*R,r[8]=d*f+p*x+g*I,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,p=c*r-a*l,g=e*u+n*d+s*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let M=1/g;return t[0]=u*M,t[1]=(s*c-h*n)*M,t[2]=(o*n-s*a)*M,t[3]=d*M,t[4]=(h*e-s*l)*M,t[5]=(s*r-o*e)*M,t[6]=p*M,t[7]=(n*l-c*e)*M,t[8]=(a*e-n*r)*M,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-s*c,s*l,-s*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(oa.makeScale(t,e)),this}rotate(t){return this.premultiply(oa.makeRotation(-t)),this}translate(t,e){return this.premultiply(oa.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},oa=new Qt;function eh(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function ys(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function vu(){let i=ys("canvas");return i.style.display="block",i}var kl={};function cs(i){i in kl||(kl[i]=!0,console.warn(i))}function yu(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function Mu(i){let t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function Su(i){let t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}var ie={enabled:!0,workingColorSpace:qn,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===le&&(i.r=Cn(i.r),i.g=Cn(i.g),i.b=Cn(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===le&&(i.r=ki(i.r),i.g=ki(i.g),i.b=ki(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===kn?Zr:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function Cn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function ki(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Hl=[.64,.33,.3,.6,.15,.06],Vl=[.2126,.7152,.0722],Gl=[.3127,.329],Wl=new Qt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Xl=new Qt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);ie.define({[qn]:{primaries:Hl,whitePoint:Gl,transfer:Zr,toXYZ:Wl,fromXYZ:Xl,luminanceCoefficients:Vl,workingColorSpaceConfig:{unpackColorSpace:Ie},outputColorSpaceConfig:{drawingBufferColorSpace:Ie}},[Ie]:{primaries:Hl,whitePoint:Gl,transfer:le,toXYZ:Wl,fromXYZ:Xl,luminanceCoefficients:Vl,outputColorSpaceConfig:{drawingBufferColorSpace:Ie}}});var Si,Eo=class{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Si===void 0&&(Si=ys("canvas")),Si.width=t.width,Si.height=t.height;let n=Si.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Si}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=ys("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Cn(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Cn(e[n]/255)*255):e[n]=Cn(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},bu=0,yr=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:bu++}),this.uuid=gi(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(la(s[a].image)):r.push(la(s[a]))}else r=la(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function la(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Eo.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var Eu=0,Oe=class i extends Wn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=An,s=An,r=Le,a=Hn,o=on,l=In,c=i.DEFAULT_ANISOTROPY,h=kn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Eu++}),this.uuid=gi(),this.name="",this.source=new yr(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new it(0,0),this.repeat=new it(1,1),this.center=new it(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Qt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Vc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case _s:t.x=t.x-Math.floor(t.x);break;case An:t.x=t.x<0?0:1;break;case $a:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case _s:t.y=t.y-Math.floor(t.y);break;case An:t.y=t.y<0?0:1;break;case $a:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Oe.DEFAULT_IMAGE=null;Oe.DEFAULT_MAPPING=Vc;Oe.DEFAULT_ANISOTROPY=1;var he=class i{constructor(t=0,e=0,n=0,s=1){i.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],g=l[9],M=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-M)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+M)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let S=(c+1)/2,x=(p+1)/2,O=(f+1)/2,R=(h+d)/4,I=(u+M)/4,A=(g+m)/4;return S>x&&S>O?S<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(S),s=R/n,r=I/n):x>O?x<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(x),n=R/s,r=A/s):O<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(O),n=I/r,s=A/r),this.set(n,s,r,e),this}let E=Math.sqrt((m-g)*(m-g)+(u-M)*(u-M)+(d-h)*(d-h));return Math.abs(E)<.001&&(E=1),this.x=(m-g)/E,this.y=(u-M)/E,this.z=(d-h)/E,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},To=class extends Wn{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new he(0,0,t,e),this.scissorTest=!1,this.viewport=new he(0,0,t,e);let s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Le,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);let r=new Oe(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];let a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;let e=Object.assign({},t.texture.image);return this.texture.source=new yr(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},Be=class extends To{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},Mr=class extends Oe{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Ye,this.minFilter=Ye,this.wrapR=An,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var wo=class extends Oe{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Ye,this.minFilter=Ye,this.wrapR=An,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Xn=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3],d=r[a+0],p=r[a+1],g=r[a+2],M=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=p,t[e+2]=g,t[e+3]=M;return}if(u!==M||l!==d||c!==p||h!==g){let m=1-o,f=l*d+c*p+h*g+u*M,E=f>=0?1:-1,S=1-f*f;if(S>Number.EPSILON){let O=Math.sqrt(S),R=Math.atan2(O,f*E);m=Math.sin(m*R)/O,o=Math.sin(o*R)/O}let x=o*E;if(l=l*m+d*x,c=c*m+p*x,h=h*m+g*x,u=u*m+M*x,m===1-o){let O=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=O,c*=O,h*=O,u*=O}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,s,r,a){let o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[a],d=r[a+1],p=r[a+2],g=r[a+3];return t[e]=o*g+h*u+l*p-c*d,t[e+1]=l*g+h*d+c*u-o*p,t[e+2]=c*g+h*p+o*d-l*u,t[e+3]=h*g-o*u-l*d-c*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),u=o(r/2),d=l(n/2),p=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"YZX":this._x=d*h*u+c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u-d*p*g;break;case"XZY":this._x=d*h*u-c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u+d*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){let p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(a-s)*p}else if(n>o&&n>u){let p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(s+a)/p,this._z=(r+c)/p}else if(o>u){let p=2*Math.sqrt(1+o-n-u);this._w=(r-c)/p,this._x=(s+a)/p,this._y=.25*p,this._z=(l+h)/p}else{let p=2*Math.sqrt(1+u-n-o);this._w=(a-s)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(be(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);let n=this._x,s=this._y,r=this._z,a=this._w,o=a*t._w+n*t._x+s*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;let l=1-o*o;if(l<=Number.EPSILON){let p=1-e;return this._w=p*a+e*this._w,this._x=p*n+e*this._x,this._y=p*s+e*this._y,this._z=p*r+e*this._z,this.normalize(),this}let c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=s*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},P=class i{constructor(t=0,e=0,n=0){i.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(ql.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(ql.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*s-o*n),h=2*(o*e-r*s),u=2*(r*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return ca.copy(this).projectOnVector(t),this.sub(ca)}reflect(t){return this.sub(ca.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(be(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ca=new P,ql=new Xn,li=class{constructor(t=new P(1/0,1/0,1/0),e=new P(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(sn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(sn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=sn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,sn):sn.fromBufferAttribute(r,a),sn.applyMatrix4(t.matrixWorld),this.expandByPoint(sn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Vs.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Vs.copy(n.boundingBox)),Vs.applyMatrix4(t.matrixWorld),this.union(Vs)}let s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,sn),sn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(ss),Gs.subVectors(this.max,ss),bi.subVectors(t.a,ss),Ei.subVectors(t.b,ss),Ti.subVectors(t.c,ss),Un.subVectors(Ei,bi),Nn.subVectors(Ti,Ei),Kn.subVectors(bi,Ti);let e=[0,-Un.z,Un.y,0,-Nn.z,Nn.y,0,-Kn.z,Kn.y,Un.z,0,-Un.x,Nn.z,0,-Nn.x,Kn.z,0,-Kn.x,-Un.y,Un.x,0,-Nn.y,Nn.x,0,-Kn.y,Kn.x,0];return!ha(e,bi,Ei,Ti,Gs)||(e=[1,0,0,0,1,0,0,0,1],!ha(e,bi,Ei,Ti,Gs))?!1:(Ws.crossVectors(Un,Nn),e=[Ws.x,Ws.y,Ws.z],ha(e,bi,Ei,Ti,Gs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,sn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(sn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(_n[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),_n[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),_n[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),_n[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),_n[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),_n[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),_n[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),_n[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(_n),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}},_n=[new P,new P,new P,new P,new P,new P,new P,new P],sn=new P,Vs=new li,bi=new P,Ei=new P,Ti=new P,Un=new P,Nn=new P,Kn=new P,ss=new P,Gs=new P,Ws=new P,Qn=new P;function ha(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Qn.fromArray(i,r);let o=s.x*Math.abs(Qn.x)+s.y*Math.abs(Qn.y)+s.z*Math.abs(Qn.z),l=t.dot(Qn),c=e.dot(Qn),h=n.dot(Qn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Tu=new li,rs=new P,ua=new P,Ms=class{constructor(t=new P,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):Tu.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;rs.subVectors(t,this.center);let e=rs.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(rs,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(ua.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(rs.copy(t.center).add(ua)),this.expandByPoint(rs.copy(t.center).sub(ua))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}},xn=new P,da=new P,Xs=new P,Fn=new P,fa=new P,qs=new P,pa=new P,Sr=class{constructor(t=new P,e=new P(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,xn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=xn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(xn.copy(this.origin).addScaledVector(this.direction,e),xn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){da.copy(t).add(e).multiplyScalar(.5),Xs.copy(e).sub(t).normalize(),Fn.copy(this.origin).sub(da);let r=t.distanceTo(e)*.5,a=-this.direction.dot(Xs),o=Fn.dot(this.direction),l=-Fn.dot(Xs),c=Fn.lengthSq(),h=Math.abs(1-a*a),u,d,p,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){let M=1/h;u*=M,d*=M,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),p=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(da).addScaledVector(Xs,d),p}intersectSphere(t,e){xn.subVectors(t.center,this.origin);let n=xn.dot(this.direction),s=xn.dot(xn)-n*n,r=t.radius*t.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,s=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,s=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,xn)!==null}intersectTriangle(t,e,n,s,r){fa.subVectors(e,t),qs.subVectors(n,t),pa.crossVectors(fa,qs);let a=this.direction.dot(pa),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Fn.subVectors(this.origin,t);let l=o*this.direction.dot(qs.crossVectors(Fn,qs));if(l<0)return null;let c=o*this.direction.dot(fa.cross(Fn));if(c<0||l+c>a)return null;let h=-o*Fn.dot(pa);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},_e=class i{constructor(t,e,n,s,r,a,o,l,c,h,u,d,p,g,M,m){i.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c,h,u,d,p,g,M,m)}set(t,e,n,s,r,a,o,l,c,h,u,d,p,g,M,m){let f=this.elements;return f[0]=t,f[4]=e,f[8]=n,f[12]=s,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=M,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){let e=this.elements,n=t.elements,s=1/wi.setFromMatrixColumn(t,0).length(),r=1/wi.setFromMatrixColumn(t,1).length(),a=1/wi.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){let d=a*h,p=a*u,g=o*h,M=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=p+g*c,e[5]=d-M*c,e[9]=-o*l,e[2]=M-d*c,e[6]=g+p*c,e[10]=a*l}else if(t.order==="YXZ"){let d=l*h,p=l*u,g=c*h,M=c*u;e[0]=d+M*o,e[4]=g*o-p,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=p*o-g,e[6]=M+d*o,e[10]=a*l}else if(t.order==="ZXY"){let d=l*h,p=l*u,g=c*h,M=c*u;e[0]=d-M*o,e[4]=-a*u,e[8]=g+p*o,e[1]=p+g*o,e[5]=a*h,e[9]=M-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){let d=a*h,p=a*u,g=o*h,M=o*u;e[0]=l*h,e[4]=g*c-p,e[8]=d*c+M,e[1]=l*u,e[5]=M*c+d,e[9]=p*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){let d=a*l,p=a*c,g=o*l,M=o*c;e[0]=l*h,e[4]=M-d*u,e[8]=g*u+p,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=p*u+g,e[10]=d-M*u}else if(t.order==="XZY"){let d=a*l,p=a*c,g=o*l,M=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+M,e[5]=a*h,e[9]=p*u-g,e[2]=g*u-p,e[6]=o*h,e[10]=M*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(wu,t,Au)}lookAt(t,e,n){let s=this.elements;return We.subVectors(t,e),We.lengthSq()===0&&(We.z=1),We.normalize(),On.crossVectors(n,We),On.lengthSq()===0&&(Math.abs(n.z)===1?We.x+=1e-4:We.z+=1e-4,We.normalize(),On.crossVectors(n,We)),On.normalize(),Ys.crossVectors(We,On),s[0]=On.x,s[4]=Ys.x,s[8]=We.x,s[1]=On.y,s[5]=Ys.y,s[9]=We.y,s[2]=On.z,s[6]=Ys.z,s[10]=We.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],g=n[2],M=n[6],m=n[10],f=n[14],E=n[3],S=n[7],x=n[11],O=n[15],R=s[0],I=s[4],A=s[8],b=s[12],y=s[1],C=s[5],H=s[9],B=s[13],z=s[2],W=s[6],k=s[10],at=s[14],G=s[3],dt=s[7],ft=s[11],Rt=s[15];return r[0]=a*R+o*y+l*z+c*G,r[4]=a*I+o*C+l*W+c*dt,r[8]=a*A+o*H+l*k+c*ft,r[12]=a*b+o*B+l*at+c*Rt,r[1]=h*R+u*y+d*z+p*G,r[5]=h*I+u*C+d*W+p*dt,r[9]=h*A+u*H+d*k+p*ft,r[13]=h*b+u*B+d*at+p*Rt,r[2]=g*R+M*y+m*z+f*G,r[6]=g*I+M*C+m*W+f*dt,r[10]=g*A+M*H+m*k+f*ft,r[14]=g*b+M*B+m*at+f*Rt,r[3]=E*R+S*y+x*z+O*G,r[7]=E*I+S*C+x*W+O*dt,r[11]=E*A+S*H+x*k+O*ft,r[15]=E*b+S*B+x*at+O*Rt,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],p=t[14],g=t[3],M=t[7],m=t[11],f=t[15];return g*(+r*l*u-s*c*u-r*o*d+n*c*d+s*o*p-n*l*p)+M*(+e*l*p-e*c*d+r*a*d-s*a*p+s*c*h-r*l*h)+m*(+e*c*u-e*o*p-r*a*u+n*a*p+r*o*h-n*c*h)+f*(-s*o*h-e*l*u+e*o*d+s*a*u-n*a*d+n*l*h)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],p=t[11],g=t[12],M=t[13],m=t[14],f=t[15],E=u*m*c-M*d*c+M*l*p-o*m*p-u*l*f+o*d*f,S=g*d*c-h*m*c-g*l*p+a*m*p+h*l*f-a*d*f,x=h*M*c-g*u*c+g*o*p-a*M*p-h*o*f+a*u*f,O=g*u*l-h*M*l-g*o*d+a*M*d+h*o*m-a*u*m,R=e*E+n*S+s*x+r*O;if(R===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let I=1/R;return t[0]=E*I,t[1]=(M*d*r-u*m*r-M*s*p+n*m*p+u*s*f-n*d*f)*I,t[2]=(o*m*r-M*l*r+M*s*c-n*m*c-o*s*f+n*l*f)*I,t[3]=(u*l*r-o*d*r-u*s*c+n*d*c+o*s*p-n*l*p)*I,t[4]=S*I,t[5]=(h*m*r-g*d*r+g*s*p-e*m*p-h*s*f+e*d*f)*I,t[6]=(g*l*r-a*m*r-g*s*c+e*m*c+a*s*f-e*l*f)*I,t[7]=(a*d*r-h*l*r+h*s*c-e*d*c-a*s*p+e*l*p)*I,t[8]=x*I,t[9]=(g*u*r-h*M*r-g*n*p+e*M*p+h*n*f-e*u*f)*I,t[10]=(a*M*r-g*o*r+g*n*c-e*M*c-a*n*f+e*o*f)*I,t[11]=(h*o*r-a*u*r-h*n*c+e*u*c+a*n*p-e*o*p)*I,t[12]=O*I,t[13]=(h*M*s-g*u*s+g*n*d-e*M*d-h*n*m+e*u*m)*I,t[14]=(g*o*s-a*M*s-g*n*l+e*M*l+a*n*m-e*o*m)*I,t[15]=(a*u*s-h*o*s+h*n*l-e*u*l-a*n*d+e*o*d)*I,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,p=r*h,g=r*u,M=a*h,m=a*u,f=o*u,E=l*c,S=l*h,x=l*u,O=n.x,R=n.y,I=n.z;return s[0]=(1-(M+f))*O,s[1]=(p+x)*O,s[2]=(g-S)*O,s[3]=0,s[4]=(p-x)*R,s[5]=(1-(d+f))*R,s[6]=(m+E)*R,s[7]=0,s[8]=(g+S)*I,s[9]=(m-E)*I,s[10]=(1-(d+M))*I,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements,r=wi.set(s[0],s[1],s[2]).length(),a=wi.set(s[4],s[5],s[6]).length(),o=wi.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],rn.copy(this);let c=1/r,h=1/a,u=1/o;return rn.elements[0]*=c,rn.elements[1]*=c,rn.elements[2]*=c,rn.elements[4]*=h,rn.elements[5]*=h,rn.elements[6]*=h,rn.elements[8]*=u,rn.elements[9]*=u,rn.elements[10]*=u,e.setFromRotationMatrix(rn),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,s,r,a,o=Rn){let l=this.elements,c=2*r/(e-t),h=2*r/(n-s),u=(e+t)/(e-t),d=(n+s)/(n-s),p,g;if(o===Rn)p=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===vr)p=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=Rn){let l=this.elements,c=1/(e-t),h=1/(n-s),u=1/(a-r),d=(e+t)*c,p=(n+s)*h,g,M;if(o===Rn)g=(a+r)*u,M=-2*u;else if(o===vr)g=r*u,M=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=M,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},wi=new P,rn=new _e,wu=new P(0,0,0),Au=new P(1,1,1),On=new P,Ys=new P,We=new P,Yl=new _e,Zl=new Xn,fn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],p=s[10];switch(e){case"XYZ":this._y=Math.asin(be(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-be(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(be(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-be(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(be(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-be(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Yl.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Yl,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Zl.setFromEuler(this),this.setFromQuaternion(Zl,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};fn.DEFAULT_ORDER="XYZ";var Ss=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Ru=0,$l=new P,Ai=new Xn,vn=new _e,Zs=new P,as=new P,Cu=new P,Iu=new Xn,Jl=new P(1,0,0),Kl=new P(0,1,0),Ql=new P(0,0,1),jl={type:"added"},Pu={type:"removed"},Ri={type:"childadded",child:null},ma={type:"childremoved",child:null},Ve=class i extends Wn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ru++}),this.uuid=gi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new P,e=new fn,n=new Xn,s=new P(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new _e},normalMatrix:{value:new Qt}}),this.matrix=new _e,this.matrixWorld=new _e,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ss,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Ai.setFromAxisAngle(t,e),this.quaternion.multiply(Ai),this}rotateOnWorldAxis(t,e){return Ai.setFromAxisAngle(t,e),this.quaternion.premultiply(Ai),this}rotateX(t){return this.rotateOnAxis(Jl,t)}rotateY(t){return this.rotateOnAxis(Kl,t)}rotateZ(t){return this.rotateOnAxis(Ql,t)}translateOnAxis(t,e){return $l.copy(t).applyQuaternion(this.quaternion),this.position.add($l.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Jl,t)}translateY(t){return this.translateOnAxis(Kl,t)}translateZ(t){return this.translateOnAxis(Ql,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(vn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Zs.copy(t):Zs.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),as.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?vn.lookAt(as,Zs,this.up):vn.lookAt(Zs,as,this.up),this.quaternion.setFromRotationMatrix(vn),s&&(vn.extractRotation(s.matrixWorld),Ai.setFromRotationMatrix(vn),this.quaternion.premultiply(Ai.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(jl),Ri.child=t,this.dispatchEvent(Ri),Ri.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Pu),ma.child=t,this.dispatchEvent(ma),ma.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),vn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),vn.multiply(t.parent.matrixWorld)),t.applyMatrix4(vn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(jl),Ri.child=t,this.dispatchEvent(Ri),Ri.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(as,t,Cu),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(as,Iu,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){let n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){let o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),p=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}};Ve.DEFAULT_UP=new P(0,1,0);Ve.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ve.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var an=new P,yn=new P,ga=new P,Mn=new P,Ci=new P,Ii=new P,tc=new P,_a=new P,xa=new P,va=new P,ya=new he,Ma=new he,Sa=new he,ri=class i{constructor(t=new P,e=new P,n=new P){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),an.subVectors(t,e),s.cross(an);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){an.subVectors(s,e),yn.subVectors(n,e),ga.subVectors(t,e);let a=an.dot(an),o=an.dot(yn),l=an.dot(ga),c=yn.dot(yn),h=yn.dot(ga),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,p=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-p-g,g,p)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Mn)===null?!1:Mn.x>=0&&Mn.y>=0&&Mn.x+Mn.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,Mn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Mn.x),l.addScaledVector(a,Mn.y),l.addScaledVector(o,Mn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return ya.setScalar(0),Ma.setScalar(0),Sa.setScalar(0),ya.fromBufferAttribute(t,e),Ma.fromBufferAttribute(t,n),Sa.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(ya,r.x),a.addScaledVector(Ma,r.y),a.addScaledVector(Sa,r.z),a}static isFrontFacing(t,e,n,s){return an.subVectors(n,e),yn.subVectors(t,e),an.cross(yn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return an.subVectors(this.c,this.b),yn.subVectors(this.a,this.b),an.cross(yn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,a,o;Ci.subVectors(s,n),Ii.subVectors(r,n),_a.subVectors(t,n);let l=Ci.dot(_a),c=Ii.dot(_a);if(l<=0&&c<=0)return e.copy(n);xa.subVectors(t,s);let h=Ci.dot(xa),u=Ii.dot(xa);if(h>=0&&u<=h)return e.copy(s);let d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(Ci,a);va.subVectors(t,r);let p=Ci.dot(va),g=Ii.dot(va);if(g>=0&&p<=g)return e.copy(r);let M=p*c-l*g;if(M<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(Ii,o);let m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return tc.subVectors(r,s),o=(u-h)/(u-h+(p-g)),e.copy(s).addScaledVector(tc,o);let f=1/(m+M+d);return a=M*f,o=d*f,e.copy(n).addScaledVector(Ci,a).addScaledVector(Ii,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},nh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Bn={h:0,s:0,l:0},$s={h:0,s:0,l:0};function ba(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Wt=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Ie){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ie.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=ie.workingColorSpace){return this.r=t,this.g=e,this.b=n,ie.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=ie.workingColorSpace){if(t=Ml(t,1),e=be(e,0,1),n=be(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=ba(a,r,t+1/3),this.g=ba(a,r,t),this.b=ba(a,r,t-1/3)}return ie.toWorkingColorSpace(this,s),this}setStyle(t,e=Ie){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Ie){let n=nh[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Cn(t.r),this.g=Cn(t.g),this.b=Cn(t.b),this}copyLinearToSRGB(t){return this.r=ki(t.r),this.g=ki(t.g),this.b=ki(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Ie){return ie.fromWorkingColorSpace(Ce.copy(this),t),Math.round(be(Ce.r*255,0,255))*65536+Math.round(be(Ce.g*255,0,255))*256+Math.round(be(Ce.b*255,0,255))}getHexString(t=Ie){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ie.workingColorSpace){ie.fromWorkingColorSpace(Ce.copy(this),e);let n=Ce.r,s=Ce.g,r=Ce.b,a=Math.max(n,s,r),o=Math.min(n,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=ie.workingColorSpace){return ie.fromWorkingColorSpace(Ce.copy(this),e),t.r=Ce.r,t.g=Ce.g,t.b=Ce.b,t}getStyle(t=Ie){ie.fromWorkingColorSpace(Ce.copy(this),t);let e=Ce.r,n=Ce.g,s=Ce.b;return t!==Ie?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Bn),this.setHSL(Bn.h+t,Bn.s+e,Bn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Bn),t.getHSL($s);let n=ds(Bn.h,$s.h,e),s=ds(Bn.s,$s.s,e),r=ds(Bn.l,$s.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ce=new Wt;Wt.NAMES=nh;var Lu=0,ci=class extends Wn{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Lu++}),this.uuid=gi(),this.name="",this.blending=Bi,this.side=Gn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ba,this.blendDst=za,this.blendEquation=si,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Wt(0,0,0),this.blendAlpha=0,this.depthFunc=Vi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Fl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Mi,this.stencilZFail=Mi,this.stencilZPass=Mi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Bi&&(n.blending=this.blending),this.side!==Gn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Ba&&(n.blendSrc=this.blendSrc),this.blendDst!==za&&(n.blendDst=this.blendDst),this.blendEquation!==si&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Vi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Fl&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Mi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Mi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Mi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(e){let r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}},pn=class extends ci{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Wt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fn,this.combine=Hc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},wn=Du();function Du(){let i=new ArrayBuffer(4),t=new Float32Array(i),e=new Uint32Array(i),n=new Uint32Array(512),s=new Uint32Array(512);for(let l=0;l<256;++l){let c=l-127;c<-27?(n[l]=0,n[l|256]=32768,s[l]=24,s[l|256]=24):c<-14?(n[l]=1024>>-c-14,n[l|256]=1024>>-c-14|32768,s[l]=-c-1,s[l|256]=-c-1):c<=15?(n[l]=c+15<<10,n[l|256]=c+15<<10|32768,s[l]=13,s[l|256]=13):c<128?(n[l]=31744,n[l|256]=64512,s[l]=24,s[l|256]=24):(n[l]=31744,n[l|256]=64512,s[l]=13,s[l|256]=13)}let r=new Uint32Array(2048),a=new Uint32Array(64),o=new Uint32Array(64);for(let l=1;l<1024;++l){let c=l<<13,h=0;for(;!(c&8388608);)c<<=1,h-=8388608;c&=-8388609,h+=947912704,r[l]=c|h}for(let l=1024;l<2048;++l)r[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)a[l]=l<<23;a[31]=1199570944,a[32]=2147483648;for(let l=33;l<63;++l)a[l]=2147483648+(l-32<<23);a[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(o[l]=1024);return{floatView:t,uint32View:e,baseTable:n,shiftTable:s,mantissaTable:r,exponentTable:a,offsetTable:o}}function Uu(i){Math.abs(i)>65504&&console.warn("THREE.DataUtils.toHalfFloat(): Value out of range."),i=be(i,-65504,65504),wn.floatView[0]=i;let t=wn.uint32View[0],e=t>>23&511;return wn.baseTable[e]+((t&8388607)>>wn.shiftTable[e])}function Nu(i){let t=i>>10;return wn.uint32View[0]=wn.mantissaTable[wn.offsetTable[t]+(i&1023)]+wn.exponentTable[t],wn.floatView[0]}var Os={toHalfFloat:Uu,fromHalfFloat:Nu},Se=new P,Js=new it,je=class{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Ol,this.updateRanges=[],this.gpuType=qe,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Js.fromBufferAttribute(this,e),Js.applyMatrix3(t),this.setXY(e,Js.x,Js.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.applyMatrix3(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.applyMatrix4(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.applyNormalMatrix(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Se.fromBufferAttribute(this,e),Se.transformDirection(t),this.setXYZ(e,Se.x,Se.y,Se.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Ni(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Ne(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Ni(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Ni(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Ni(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Ni(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Ne(e,this.array),n=Ne(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Ne(e,this.array),n=Ne(n,this.array),s=Ne(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Ne(e,this.array),n=Ne(n,this.array),s=Ne(s,this.array),r=Ne(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Ol&&(t.usage=this.usage),t}};var br=class extends je{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var Er=class extends je{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var re=class extends je{constructor(t,e,n){super(new Float32Array(t),e,n)}},Fu=0,Qe=new _e,Ea=new Ve,Pi=new P,Xe=new li,os=new li,Ae=new P,De=class i extends Wn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Fu++}),this.uuid=gi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(eh(t)?Er:br)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Qt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Qe.makeRotationFromQuaternion(t),this.applyMatrix4(Qe),this}rotateX(t){return Qe.makeRotationX(t),this.applyMatrix4(Qe),this}rotateY(t){return Qe.makeRotationY(t),this.applyMatrix4(Qe),this}rotateZ(t){return Qe.makeRotationZ(t),this.applyMatrix4(Qe),this}translate(t,e,n){return Qe.makeTranslation(t,e,n),this.applyMatrix4(Qe),this}scale(t,e,n){return Qe.makeScale(t,e,n),this.applyMatrix4(Qe),this}lookAt(t){return Ea.lookAt(t),Ea.updateMatrix(),this.applyMatrix4(Ea.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Pi).negate(),this.translate(Pi.x,Pi.y,Pi.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new re(n,3))}else{for(let n=0,s=e.count;n<s;n++){let r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new li);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new P(-1/0,-1/0,-1/0),new P(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];Xe.setFromBufferAttribute(r),this.morphTargetsRelative?(Ae.addVectors(this.boundingBox.min,Xe.min),this.boundingBox.expandByPoint(Ae),Ae.addVectors(this.boundingBox.max,Xe.max),this.boundingBox.expandByPoint(Ae)):(this.boundingBox.expandByPoint(Xe.min),this.boundingBox.expandByPoint(Xe.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ms);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new P,1/0);return}if(t){let n=this.boundingSphere.center;if(Xe.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){let o=e[r];os.setFromBufferAttribute(o),this.morphTargetsRelative?(Ae.addVectors(Xe.min,os.min),Xe.expandByPoint(Ae),Ae.addVectors(Xe.max,os.max),Xe.expandByPoint(Ae)):(Xe.expandByPoint(os.min),Xe.expandByPoint(os.max))}Xe.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)Ae.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Ae));if(e)for(let r=0,a=e.length;r<a;r++){let o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Ae.fromBufferAttribute(o,c),l&&(Pi.fromBufferAttribute(t,c),Ae.add(Pi)),s=Math.max(s,n.distanceToSquared(Ae))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new je(new Float32Array(4*n.count),4));let a=this.getAttribute("tangent"),o=[],l=[];for(let A=0;A<n.count;A++)o[A]=new P,l[A]=new P;let c=new P,h=new P,u=new P,d=new it,p=new it,g=new it,M=new P,m=new P;function f(A,b,y){c.fromBufferAttribute(n,A),h.fromBufferAttribute(n,b),u.fromBufferAttribute(n,y),d.fromBufferAttribute(r,A),p.fromBufferAttribute(r,b),g.fromBufferAttribute(r,y),h.sub(c),u.sub(c),p.sub(d),g.sub(d);let C=1/(p.x*g.y-g.x*p.y);isFinite(C)&&(M.copy(h).multiplyScalar(g.y).addScaledVector(u,-p.y).multiplyScalar(C),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-g.x).multiplyScalar(C),o[A].add(M),o[b].add(M),o[y].add(M),l[A].add(m),l[b].add(m),l[y].add(m))}let E=this.groups;E.length===0&&(E=[{start:0,count:t.count}]);for(let A=0,b=E.length;A<b;++A){let y=E[A],C=y.start,H=y.count;for(let B=C,z=C+H;B<z;B+=3)f(t.getX(B+0),t.getX(B+1),t.getX(B+2))}let S=new P,x=new P,O=new P,R=new P;function I(A){O.fromBufferAttribute(s,A),R.copy(O);let b=o[A];S.copy(b),S.sub(O.multiplyScalar(O.dot(b))).normalize(),x.crossVectors(R,b);let C=x.dot(l[A])<0?-1:1;a.setXYZW(A,S.x,S.y,S.z,C)}for(let A=0,b=E.length;A<b;++A){let y=E[A],C=y.start,H=y.count;for(let B=C,z=C+H;B<z;B+=3)I(t.getX(B+0)),I(t.getX(B+1)),I(t.getX(B+2))}}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new je(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);let s=new P,r=new P,a=new P,o=new P,l=new P,c=new P,h=new P,u=new P;if(t)for(let d=0,p=t.count;d<p;d+=3){let g=t.getX(d+0),M=t.getX(d+1),m=t.getX(d+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,M),a.fromBufferAttribute(e,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,M),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(M,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=e.count;d<p;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ae.fromBufferAttribute(t,e),Ae.normalize(),t.setXYZ(e,Ae.x,Ae.y,Ae.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h),p=0,g=0;for(let M=0,m=l.length;M<m;M++){o.isInterleavedBufferAttribute?p=l[M]*o.data.stride+o.offset:p=l[M]*h;for(let f=0;f<h;f++)d[g++]=c[p++]}return new je(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,n);e.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){let d=c[h],p=t(d,n);l.push(p)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){let p=c[u];h.push(p.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone(e));let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],u=r[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let a=t.groups;for(let c=0,h=a.length;c<h;c++){let u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},ec=new _e,jn=new Sr,Ks=new Ms,nc=new P,Qs=new P,js=new P,tr=new P,Ta=new P,er=new P,ic=new P,nr=new P,Vt=class extends Ve{constructor(t=new De,e=new pn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(r&&o){er.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],u=r[l];h!==0&&(Ta.fromBufferAttribute(u,t),a?er.addScaledVector(Ta,h):er.addScaledVector(Ta.sub(e),h))}e.add(er)}return e}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Ks.copy(n.boundingSphere),Ks.applyMatrix4(r),jn.copy(t.ray).recast(t.near),!(Ks.containsPoint(jn.origin)===!1&&(jn.intersectSphere(Ks,nc)===null||jn.origin.distanceToSquared(nc)>(t.far-t.near)**2))&&(ec.copy(r).invert(),jn.copy(t.ray).applyMatrix4(ec),!(n.boundingBox!==null&&jn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,jn)))}_computeIntersections(t,e,n){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,M=d.length;g<M;g++){let m=d[g],f=a[m.materialIndex],E=Math.max(m.start,p.start),S=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let x=E,O=S;x<O;x+=3){let R=o.getX(x),I=o.getX(x+1),A=o.getX(x+2);s=ir(this,f,t,n,c,h,u,R,I,A),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,p.start),M=Math.min(o.count,p.start+p.count);for(let m=g,f=M;m<f;m+=3){let E=o.getX(m),S=o.getX(m+1),x=o.getX(m+2);s=ir(this,a,t,n,c,h,u,E,S,x),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,M=d.length;g<M;g++){let m=d[g],f=a[m.materialIndex],E=Math.max(m.start,p.start),S=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let x=E,O=S;x<O;x+=3){let R=x,I=x+1,A=x+2;s=ir(this,f,t,n,c,h,u,R,I,A),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,p.start),M=Math.min(l.count,p.start+p.count);for(let m=g,f=M;m<f;m+=3){let E=m,S=m+1,x=m+2;s=ir(this,a,t,n,c,h,u,E,S,x),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}};function Ou(i,t,e,n,s,r,a,o){let l;if(t.side===He?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===Gn,o),l===null)return null;nr.copy(o),nr.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(nr);return c<e.near||c>e.far?null:{distance:c,point:nr.clone(),object:i}}function ir(i,t,e,n,s,r,a,o,l,c){i.getVertexPosition(o,Qs),i.getVertexPosition(l,js),i.getVertexPosition(c,tr);let h=Ou(i,t,e,n,Qs,js,tr,ic);if(h){let u=new P;ri.getBarycoord(ic,Qs,js,tr,u),s&&(h.uv=ri.getInterpolatedAttribute(s,o,l,c,u,new it)),r&&(h.uv1=ri.getInterpolatedAttribute(r,o,l,c,u,new it)),a&&(h.normal=ri.getInterpolatedAttribute(a,o,l,c,u,new P),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:l,c,normal:new P,materialIndex:0};ri.getNormal(Qs,js,tr,d.normal),h.face=d,h.barycoord=u}return h}var Ze=class i extends De{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],u=[],d=0,p=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,s,a,2),g("x","z","y",1,-1,t,n,-e,s,a,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new re(c,3)),this.setAttribute("normal",new re(h,3)),this.setAttribute("uv",new re(u,2));function g(M,m,f,E,S,x,O,R,I,A,b){let y=x/I,C=O/A,H=x/2,B=O/2,z=R/2,W=I+1,k=A+1,at=0,G=0,dt=new P;for(let ft=0;ft<k;ft++){let Rt=ft*C-B;for(let Ft=0;Ft<W;Ft++){let Zt=Ft*y-H;dt[M]=Zt*E,dt[m]=Rt*S,dt[f]=z,c.push(dt.x,dt.y,dt.z),dt[M]=0,dt[m]=0,dt[f]=R>0?1:-1,h.push(dt.x,dt.y,dt.z),u.push(Ft/I),u.push(1-ft/A),at+=1}}for(let ft=0;ft<A;ft++)for(let Rt=0;Rt<I;Rt++){let Ft=d+Rt+W*ft,Zt=d+Rt+W*(ft+1),$=d+(Rt+1)+W*(ft+1),ct=d+(Rt+1)+W*ft;l.push(Ft,Zt,ct),l.push(Zt,$,ct),G+=6}o.addGroup(p,G,b),p+=G,d+=at}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};function Yi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function Fe(i){let t={};for(let e=0;e<i.length;e++){let n=Yi(i[e]);for(let s in n)t[s]=n[s]}return t}function Bu(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function ih(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ie.workingColorSpace}var Yn={clone:Yi,merge:Fe},zu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ku=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ee=class extends ci{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=zu,this.fragmentShader=ku,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Yi(t.uniforms),this.uniformsGroups=Bu(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}},Tr=class extends Ve{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new _e,this.projectionMatrix=new _e,this.projectionMatrixInverse=new _e,this.coordinateSystem=Rn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},zn=new P,sc=new it,rc=new it,Pe=class extends Tr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=vs*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(us*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return vs*2*Math.atan(Math.tan(us*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){zn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(zn.x,zn.y).multiplyScalar(-t/zn.z),zn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(zn.x,zn.y).multiplyScalar(-t/zn.z)}getViewSize(t,e){return this.getViewBounds(t,sc,rc),e.subVectors(rc,sc)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(us*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}},Li=-90,Di=1,Ao=class extends Ve{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Pe(Li,Di,t,e);s.layers=this.layers,this.add(s);let r=new Pe(Li,Di,t,e);r.layers=this.layers,this.add(r);let a=new Pe(Li,Di,t,e);a.layers=this.layers,this.add(a);let o=new Pe(Li,Di,t,e);o.layers=this.layers,this.add(o);let l=new Pe(Li,Di,t,e);l.layers=this.layers,this.add(l);let c=new Pe(Li,Di,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(let c of e)this.remove(c);if(t===Rn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===vr)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let M=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,a),t.setRenderTarget(n,2,s),t.render(e,o),t.setRenderTarget(n,3,s),t.render(e,l),t.setRenderTarget(n,4,s),t.render(e,c),n.texture.generateMipmaps=M,t.setRenderTarget(n,5,s),t.render(e,h),t.setRenderTarget(u,d,p),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},wr=class extends Oe{constructor(t,e,n,s,r,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:Gi,super(t,e,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},Ro=class extends Be{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new wr(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:Le}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Ze(5,5,5),r=new Ee({name:"CubemapFromEquirect",uniforms:Yi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:He,blending:dn});r.uniforms.tEquirect.value=e;let a=new Vt(s,r),o=e.minFilter;return e.minFilter===Hn&&(e.minFilter=Le),new Ao(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,s){let r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}},wa=new P,Hu=new P,Vu=new Qt,En=class{constructor(t=new P(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=wa.subVectors(n,e).cross(Hu.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){let n=t.delta(wa),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Vu.getNormalMatrix(t),s=this.coplanarPoint(wa).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},ti=new Ms,sr=new P,bs=class{constructor(t=new En,e=new En,n=new En,s=new En,r=new En,a=new En){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Rn){let n=this.planes,s=t.elements,r=s[0],a=s[1],o=s[2],l=s[3],c=s[4],h=s[5],u=s[6],d=s[7],p=s[8],g=s[9],M=s[10],m=s[11],f=s[12],E=s[13],S=s[14],x=s[15];if(n[0].setComponents(l-r,d-c,m-p,x-f).normalize(),n[1].setComponents(l+r,d+c,m+p,x+f).normalize(),n[2].setComponents(l+a,d+h,m+g,x+E).normalize(),n[3].setComponents(l-a,d-h,m-g,x-E).normalize(),n[4].setComponents(l-o,d-u,m-M,x-S).normalize(),e===Rn)n[5].setComponents(l+o,d+u,m+M,x+S).normalize();else if(e===vr)n[5].setComponents(o,u,M,S).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),ti.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),ti.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(ti)}intersectsSprite(t){return ti.center.set(0,0,0),ti.radius=.7071067811865476,ti.applyMatrix4(t.matrixWorld),this.intersectsSphere(ti)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(sr.x=s.normal.x>0?t.max.x:t.min.x,sr.y=s.normal.y>0?t.max.y:t.min.y,sr.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(sr)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function sh(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Gu(i){let t=new WeakMap;function e(o,l){let c=o.array,h=o.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){let h=l.array,u=l.updateRanges;if(i.bindBuffer(c,o),u.length===0)i.bufferSubData(c,0,h);else{u.sort((p,g)=>p.start-g.start);let d=0;for(let p=1;p<u.length;p++){let g=u[d],M=u[p];M.start<=g.start+g.count+1?g.count=Math.max(g.count,M.start+M.count-g.start):(++d,u[d]=M)}u.length=d+1;for(let p=0,g=u.length;p<g;p++){let M=u[p];i.bufferSubData(c,M.start*h.BYTES_PER_ELEMENT,h,M.start,M.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var $e=class i extends De{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,u=t/o,d=e/l,p=[],g=[],M=[],m=[];for(let f=0;f<h;f++){let E=f*d-a;for(let S=0;S<c;S++){let x=S*u-r;g.push(x,-E,0),M.push(0,0,1),m.push(S/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let E=0;E<o;E++){let S=E+c*f,x=E+c*(f+1),O=E+1+c*(f+1),R=E+1+c*f;p.push(S,x,R),p.push(x,O,R)}this.setIndex(p),this.setAttribute("position",new re(g,3)),this.setAttribute("normal",new re(M,3)),this.setAttribute("uv",new re(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}},Wu=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Xu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,qu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Yu=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Zu=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,$u=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Ju=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Ku=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Qu=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,ju=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,td=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,ed=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,nd=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,id=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,sd=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,rd=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,ad=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,od=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,ld=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,cd=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,hd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,ud=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,dd=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,fd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,pd=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,md=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,gd=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,_d=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,xd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,vd=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,yd="gl_FragColor = linearToOutputTexel( gl_FragColor );",Md=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Sd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,bd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Ed=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Td=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,wd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Ad=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Rd=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Cd=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Id=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Pd=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Ld=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Dd=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Ud=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Nd=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Fd=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Od=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Bd=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,zd=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,kd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Hd=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Vd=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Gd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Wd=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Xd=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,qd=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Yd=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Zd=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,$d=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Jd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Kd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Qd=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,jd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,tf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,ef=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,nf=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,sf=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,rf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,af=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,of=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,lf=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,cf=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,hf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,uf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,df=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,ff=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,pf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,mf=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,gf=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,_f=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,xf=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,vf=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,yf=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Mf=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Sf=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,bf=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Ef=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Tf=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,wf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Af=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Rf=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Cf=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,If=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Pf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Lf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Df=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Uf=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Nf=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Ff=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Of=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Bf=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,zf=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,kf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Hf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Vf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Gf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Wf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Xf=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,qf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Yf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Zf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,$f=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Jf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Kf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Qf=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,jf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,tp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,ep=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,np=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,ip=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,rp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ap=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,op=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,lp=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,cp=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,hp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,up=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,dp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,fp=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pp=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,mp=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,_p=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,xp=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,vp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,yp=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Mp=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Sp=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,bp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,jt={alphahash_fragment:Wu,alphahash_pars_fragment:Xu,alphamap_fragment:qu,alphamap_pars_fragment:Yu,alphatest_fragment:Zu,alphatest_pars_fragment:$u,aomap_fragment:Ju,aomap_pars_fragment:Ku,batching_pars_vertex:Qu,batching_vertex:ju,begin_vertex:td,beginnormal_vertex:ed,bsdfs:nd,iridescence_fragment:id,bumpmap_pars_fragment:sd,clipping_planes_fragment:rd,clipping_planes_pars_fragment:ad,clipping_planes_pars_vertex:od,clipping_planes_vertex:ld,color_fragment:cd,color_pars_fragment:hd,color_pars_vertex:ud,color_vertex:dd,common:fd,cube_uv_reflection_fragment:pd,defaultnormal_vertex:md,displacementmap_pars_vertex:gd,displacementmap_vertex:_d,emissivemap_fragment:xd,emissivemap_pars_fragment:vd,colorspace_fragment:yd,colorspace_pars_fragment:Md,envmap_fragment:Sd,envmap_common_pars_fragment:bd,envmap_pars_fragment:Ed,envmap_pars_vertex:Td,envmap_physical_pars_fragment:Fd,envmap_vertex:wd,fog_vertex:Ad,fog_pars_vertex:Rd,fog_fragment:Cd,fog_pars_fragment:Id,gradientmap_pars_fragment:Pd,lightmap_pars_fragment:Ld,lights_lambert_fragment:Dd,lights_lambert_pars_fragment:Ud,lights_pars_begin:Nd,lights_toon_fragment:Od,lights_toon_pars_fragment:Bd,lights_phong_fragment:zd,lights_phong_pars_fragment:kd,lights_physical_fragment:Hd,lights_physical_pars_fragment:Vd,lights_fragment_begin:Gd,lights_fragment_maps:Wd,lights_fragment_end:Xd,logdepthbuf_fragment:qd,logdepthbuf_pars_fragment:Yd,logdepthbuf_pars_vertex:Zd,logdepthbuf_vertex:$d,map_fragment:Jd,map_pars_fragment:Kd,map_particle_fragment:Qd,map_particle_pars_fragment:jd,metalnessmap_fragment:tf,metalnessmap_pars_fragment:ef,morphinstance_vertex:nf,morphcolor_vertex:sf,morphnormal_vertex:rf,morphtarget_pars_vertex:af,morphtarget_vertex:of,normal_fragment_begin:lf,normal_fragment_maps:cf,normal_pars_fragment:hf,normal_pars_vertex:uf,normal_vertex:df,normalmap_pars_fragment:ff,clearcoat_normal_fragment_begin:pf,clearcoat_normal_fragment_maps:mf,clearcoat_pars_fragment:gf,iridescence_pars_fragment:_f,opaque_fragment:xf,packing:vf,premultiplied_alpha_fragment:yf,project_vertex:Mf,dithering_fragment:Sf,dithering_pars_fragment:bf,roughnessmap_fragment:Ef,roughnessmap_pars_fragment:Tf,shadowmap_pars_fragment:wf,shadowmap_pars_vertex:Af,shadowmap_vertex:Rf,shadowmask_pars_fragment:Cf,skinbase_vertex:If,skinning_pars_vertex:Pf,skinning_vertex:Lf,skinnormal_vertex:Df,specularmap_fragment:Uf,specularmap_pars_fragment:Nf,tonemapping_fragment:Ff,tonemapping_pars_fragment:Of,transmission_fragment:Bf,transmission_pars_fragment:zf,uv_pars_fragment:kf,uv_pars_vertex:Hf,uv_vertex:Vf,worldpos_vertex:Gf,background_vert:Wf,background_frag:Xf,backgroundCube_vert:qf,backgroundCube_frag:Yf,cube_vert:Zf,cube_frag:$f,depth_vert:Jf,depth_frag:Kf,distanceRGBA_vert:Qf,distanceRGBA_frag:jf,equirect_vert:tp,equirect_frag:ep,linedashed_vert:np,linedashed_frag:ip,meshbasic_vert:sp,meshbasic_frag:rp,meshlambert_vert:ap,meshlambert_frag:op,meshmatcap_vert:lp,meshmatcap_frag:cp,meshnormal_vert:hp,meshnormal_frag:up,meshphong_vert:dp,meshphong_frag:fp,meshphysical_vert:pp,meshphysical_frag:mp,meshtoon_vert:gp,meshtoon_frag:_p,points_vert:xp,points_frag:vp,shadow_vert:yp,shadow_frag:Mp,sprite_vert:Sp,sprite_frag:bp},Mt={common:{diffuse:{value:new Wt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Qt},alphaMap:{value:null},alphaMapTransform:{value:new Qt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Qt}},envmap:{envMap:{value:null},envMapRotation:{value:new Qt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Qt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Qt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Qt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Qt},normalScale:{value:new it(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Qt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Qt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Qt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Qt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Wt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Wt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Qt},alphaTest:{value:0},uvTransform:{value:new Qt}},sprite:{diffuse:{value:new Wt(16777215)},opacity:{value:1},center:{value:new it(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Qt},alphaMap:{value:null},alphaMapTransform:{value:new Qt},alphaTest:{value:0}}},un={basic:{uniforms:Fe([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.fog]),vertexShader:jt.meshbasic_vert,fragmentShader:jt.meshbasic_frag},lambert:{uniforms:Fe([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Wt(0)}}]),vertexShader:jt.meshlambert_vert,fragmentShader:jt.meshlambert_frag},phong:{uniforms:Fe([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Wt(0)},specular:{value:new Wt(1118481)},shininess:{value:30}}]),vertexShader:jt.meshphong_vert,fragmentShader:jt.meshphong_frag},standard:{uniforms:Fe([Mt.common,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.roughnessmap,Mt.metalnessmap,Mt.fog,Mt.lights,{emissive:{value:new Wt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag},toon:{uniforms:Fe([Mt.common,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.gradientmap,Mt.fog,Mt.lights,{emissive:{value:new Wt(0)}}]),vertexShader:jt.meshtoon_vert,fragmentShader:jt.meshtoon_frag},matcap:{uniforms:Fe([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,{matcap:{value:null}}]),vertexShader:jt.meshmatcap_vert,fragmentShader:jt.meshmatcap_frag},points:{uniforms:Fe([Mt.points,Mt.fog]),vertexShader:jt.points_vert,fragmentShader:jt.points_frag},dashed:{uniforms:Fe([Mt.common,Mt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:jt.linedashed_vert,fragmentShader:jt.linedashed_frag},depth:{uniforms:Fe([Mt.common,Mt.displacementmap]),vertexShader:jt.depth_vert,fragmentShader:jt.depth_frag},normal:{uniforms:Fe([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,{opacity:{value:1}}]),vertexShader:jt.meshnormal_vert,fragmentShader:jt.meshnormal_frag},sprite:{uniforms:Fe([Mt.sprite,Mt.fog]),vertexShader:jt.sprite_vert,fragmentShader:jt.sprite_frag},background:{uniforms:{uvTransform:{value:new Qt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:jt.background_vert,fragmentShader:jt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Qt}},vertexShader:jt.backgroundCube_vert,fragmentShader:jt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:jt.cube_vert,fragmentShader:jt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:jt.equirect_vert,fragmentShader:jt.equirect_frag},distanceRGBA:{uniforms:Fe([Mt.common,Mt.displacementmap,{referencePosition:{value:new P},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:jt.distanceRGBA_vert,fragmentShader:jt.distanceRGBA_frag},shadow:{uniforms:Fe([Mt.lights,Mt.fog,{color:{value:new Wt(0)},opacity:{value:1}}]),vertexShader:jt.shadow_vert,fragmentShader:jt.shadow_frag}};un.physical={uniforms:Fe([un.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Qt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Qt},clearcoatNormalScale:{value:new it(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Qt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Qt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Qt},sheen:{value:0},sheenColor:{value:new Wt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Qt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Qt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Qt},transmissionSamplerSize:{value:new it},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Qt},attenuationDistance:{value:0},attenuationColor:{value:new Wt(0)},specularColor:{value:new Wt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Qt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Qt},anisotropyVector:{value:new it},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Qt}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag};var rr={r:0,b:0,g:0},ei=new fn,Ep=new _e;function Tp(i,t,e,n,s,r,a){let o=new Wt(0),l=r===!0?0:1,c,h,u=null,d=0,p=null;function g(E){let S=E.isScene===!0?E.background:null;return S&&S.isTexture&&(S=(E.backgroundBlurriness>0?e:t).get(S)),S}function M(E){let S=!1,x=g(E);x===null?f(o,l):x&&x.isColor&&(f(x,1),S=!0);let O=i.xr.getEnvironmentBlendMode();O==="additive"?n.buffers.color.setClear(0,0,0,1,a):O==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||S)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(E,S){let x=g(S);x&&(x.isCubeTexture||x.mapping===Yr)?(h===void 0&&(h=new Vt(new Ze(1,1,1),new Ee({name:"BackgroundCubeMaterial",uniforms:Yi(un.backgroundCube.uniforms),vertexShader:un.backgroundCube.vertexShader,fragmentShader:un.backgroundCube.fragmentShader,side:He,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(O,R,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),ei.copy(S.backgroundRotation),ei.x*=-1,ei.y*=-1,ei.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(ei.y*=-1,ei.z*=-1),h.material.uniforms.envMap.value=x,h.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(Ep.makeRotationFromEuler(ei)),h.material.toneMapped=ie.getTransfer(x.colorSpace)!==le,(u!==x||d!==x.version||p!==i.toneMapping)&&(h.material.needsUpdate=!0,u=x,d=x.version,p=i.toneMapping),h.layers.enableAll(),E.unshift(h,h.geometry,h.material,0,0,null)):x&&x.isTexture&&(c===void 0&&(c=new Vt(new $e(2,2),new Ee({name:"BackgroundMaterial",uniforms:Yi(un.background.uniforms),vertexShader:un.background.vertexShader,fragmentShader:un.background.fragmentShader,side:Gn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=x,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.toneMapped=ie.getTransfer(x.colorSpace)!==le,x.matrixAutoUpdate===!0&&x.updateMatrix(),c.material.uniforms.uvTransform.value.copy(x.matrix),(u!==x||d!==x.version||p!==i.toneMapping)&&(c.material.needsUpdate=!0,u=x,d=x.version,p=i.toneMapping),c.layers.enableAll(),E.unshift(c,c.geometry,c.material,0,0,null))}function f(E,S){E.getRGB(rr,ih(i)),n.buffers.color.setClear(rr.r,rr.g,rr.b,S,a)}return{getClearColor:function(){return o},setClearColor:function(E,S=1){o.set(E),l=S,f(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(E){l=E,f(o,l)},render:M,addToRenderList:m}}function wp(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null),r=s,a=!1;function o(y,C,H,B,z){let W=!1,k=u(B,H,C);r!==k&&(r=k,c(r.object)),W=p(y,B,H,z),W&&g(y,B,H,z),z!==null&&t.update(z,i.ELEMENT_ARRAY_BUFFER),(W||a)&&(a=!1,x(y,C,H,B),z!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(z).buffer))}function l(){return i.createVertexArray()}function c(y){return i.bindVertexArray(y)}function h(y){return i.deleteVertexArray(y)}function u(y,C,H){let B=H.wireframe===!0,z=n[y.id];z===void 0&&(z={},n[y.id]=z);let W=z[C.id];W===void 0&&(W={},z[C.id]=W);let k=W[B];return k===void 0&&(k=d(l()),W[B]=k),k}function d(y){let C=[],H=[],B=[];for(let z=0;z<e;z++)C[z]=0,H[z]=0,B[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:C,enabledAttributes:H,attributeDivisors:B,object:y,attributes:{},index:null}}function p(y,C,H,B){let z=r.attributes,W=C.attributes,k=0,at=H.getAttributes();for(let G in at)if(at[G].location>=0){let ft=z[G],Rt=W[G];if(Rt===void 0&&(G==="instanceMatrix"&&y.instanceMatrix&&(Rt=y.instanceMatrix),G==="instanceColor"&&y.instanceColor&&(Rt=y.instanceColor)),ft===void 0||ft.attribute!==Rt||Rt&&ft.data!==Rt.data)return!0;k++}return r.attributesNum!==k||r.index!==B}function g(y,C,H,B){let z={},W=C.attributes,k=0,at=H.getAttributes();for(let G in at)if(at[G].location>=0){let ft=W[G];ft===void 0&&(G==="instanceMatrix"&&y.instanceMatrix&&(ft=y.instanceMatrix),G==="instanceColor"&&y.instanceColor&&(ft=y.instanceColor));let Rt={};Rt.attribute=ft,ft&&ft.data&&(Rt.data=ft.data),z[G]=Rt,k++}r.attributes=z,r.attributesNum=k,r.index=B}function M(){let y=r.newAttributes;for(let C=0,H=y.length;C<H;C++)y[C]=0}function m(y){f(y,0)}function f(y,C){let H=r.newAttributes,B=r.enabledAttributes,z=r.attributeDivisors;H[y]=1,B[y]===0&&(i.enableVertexAttribArray(y),B[y]=1),z[y]!==C&&(i.vertexAttribDivisor(y,C),z[y]=C)}function E(){let y=r.newAttributes,C=r.enabledAttributes;for(let H=0,B=C.length;H<B;H++)C[H]!==y[H]&&(i.disableVertexAttribArray(H),C[H]=0)}function S(y,C,H,B,z,W,k){k===!0?i.vertexAttribIPointer(y,C,H,z,W):i.vertexAttribPointer(y,C,H,B,z,W)}function x(y,C,H,B){M();let z=B.attributes,W=H.getAttributes(),k=C.defaultAttributeValues;for(let at in W){let G=W[at];if(G.location>=0){let dt=z[at];if(dt===void 0&&(at==="instanceMatrix"&&y.instanceMatrix&&(dt=y.instanceMatrix),at==="instanceColor"&&y.instanceColor&&(dt=y.instanceColor)),dt!==void 0){let ft=dt.normalized,Rt=dt.itemSize,Ft=t.get(dt);if(Ft===void 0)continue;let Zt=Ft.buffer,$=Ft.type,ct=Ft.bytesPerElement,Tt=$===i.INT||$===i.UNSIGNED_INT||dt.gpuType===ml;if(dt.isInterleavedBufferAttribute){let lt=dt.data,Bt=lt.stride,Ht=dt.offset;if(lt.isInstancedInterleavedBuffer){for(let Gt=0;Gt<G.locationSize;Gt++)f(G.location+Gt,lt.meshPerAttribute);y.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=lt.meshPerAttribute*lt.count)}else for(let Gt=0;Gt<G.locationSize;Gt++)m(G.location+Gt);i.bindBuffer(i.ARRAY_BUFFER,Zt);for(let Gt=0;Gt<G.locationSize;Gt++)S(G.location+Gt,Rt/G.locationSize,$,ft,Bt*ct,(Ht+Rt/G.locationSize*Gt)*ct,Tt)}else{if(dt.isInstancedBufferAttribute){for(let lt=0;lt<G.locationSize;lt++)f(G.location+lt,dt.meshPerAttribute);y.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=dt.meshPerAttribute*dt.count)}else for(let lt=0;lt<G.locationSize;lt++)m(G.location+lt);i.bindBuffer(i.ARRAY_BUFFER,Zt);for(let lt=0;lt<G.locationSize;lt++)S(G.location+lt,Rt/G.locationSize,$,ft,Rt*ct,Rt/G.locationSize*lt*ct,Tt)}}else if(k!==void 0){let ft=k[at];if(ft!==void 0)switch(ft.length){case 2:i.vertexAttrib2fv(G.location,ft);break;case 3:i.vertexAttrib3fv(G.location,ft);break;case 4:i.vertexAttrib4fv(G.location,ft);break;default:i.vertexAttrib1fv(G.location,ft)}}}}E()}function O(){A();for(let y in n){let C=n[y];for(let H in C){let B=C[H];for(let z in B)h(B[z].object),delete B[z];delete C[H]}delete n[y]}}function R(y){if(n[y.id]===void 0)return;let C=n[y.id];for(let H in C){let B=C[H];for(let z in B)h(B[z].object),delete B[z];delete C[H]}delete n[y.id]}function I(y){for(let C in n){let H=n[C];if(H[y.id]===void 0)continue;let B=H[y.id];for(let z in B)h(B[z].object),delete B[z];delete H[y.id]}}function A(){b(),a=!0,r!==s&&(r=s,c(r.object))}function b(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:A,resetDefaultState:b,dispose:O,releaseStatesOfGeometry:R,releaseStatesOfProgram:I,initAttributes:M,enableAttribute:m,disableUnusedAttributes:E}}function Ap(i,t,e){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),e.update(h,n,1)}function a(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),e.update(h,n,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let p=0;for(let g=0;g<u;g++)p+=h[g];e.update(p,n,1)}function l(c,h,u,d){if(u===0)return;let p=t.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<c.length;g++)a(c[g],h[g],d[g]);else{p.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let g=0;for(let M=0;M<u;M++)g+=h[M]*d[M];e.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Rp(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let I=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(I.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(I){return!(I!==on&&n.convert(I)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(I){let A=I===Ue&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(I!==In&&n.convert(I)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&I!==qe&&!A)}function l(I){if(I==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";I="mediump"}return I==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),M=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),f=i.getParameter(i.MAX_VERTEX_ATTRIBS),E=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),S=i.getParameter(i.MAX_VARYING_VECTORS),x=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),O=g>0,R=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:p,maxVertexTextures:g,maxTextureSize:M,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:E,maxVaryings:S,maxFragmentUniforms:x,vertexTextures:O,maxSamples:R}}function Cp(i){let t=this,e=null,n=0,s=!1,r=!1,a=new En,o=new Qt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let p=u.length!==0||d||n!==0||s;return s=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,p){let g=u.clippingPlanes,M=u.clipIntersection,m=u.clipShadows,f=i.get(u);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{let E=r?0:n,S=E*4,x=f.clippingState||null;l.value=x,x=h(g,d,S,p);for(let O=0;O!==S;++O)x[O]=e[O];f.clippingState=x,this.numIntersection=M?this.numPlanes:0,this.numPlanes+=E}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,p,g){let M=u!==null?u.length:0,m=null;if(M!==0){if(m=l.value,g!==!0||m===null){let f=p+M*4,E=d.matrixWorldInverse;o.getNormalMatrix(E),(m===null||m.length<f)&&(m=new Float32Array(f));for(let S=0,x=p;S!==M;++S,x+=4)a.copy(u[S]).applyMatrix4(E,o),a.normal.toArray(m,x),m[x+3]=a.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=M,t.numIntersection=0,m}}function Ip(i){let t=new WeakMap;function e(a,o){return o===Ya?a.mapping=Gi:o===Za&&(a.mapping=Wi),a}function n(a){if(a&&a.isTexture){let o=a.mapping;if(o===Ya||o===Za)if(t.has(a)){let l=t.get(a).texture;return e(l,a.mapping)}else{let l=a.image;if(l&&l.height>0){let c=new Ro(l.height);return c.fromEquirectangularTexture(i,a),t.set(a,c),a.addEventListener("dispose",s),e(c.texture,a.mapping)}else return null}}return a}function s(a){let o=a.target;o.removeEventListener("dispose",s);let l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}var Zi=class extends Tr{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},Fi=4,ac=[.125,.215,.35,.446,.526,.582],ai=20,Aa=new Zi,oc=new Wt,Ra=null,Ca=0,Ia=0,Pa=!1,ii=(1+Math.sqrt(5))/2,Ui=1/ii,lc=[new P(-ii,Ui,0),new P(ii,Ui,0),new P(-Ui,0,ii),new P(Ui,0,ii),new P(0,ii,-Ui),new P(0,ii,Ui),new P(-1,1,-1),new P(1,1,-1),new P(-1,1,1),new P(1,1,1)],$i=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){Ra=this._renderer.getRenderTarget(),Ca=this._renderer.getActiveCubeFace(),Ia=this._renderer.getActiveMipmapLevel(),Pa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=uc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=hc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Ra,Ca,Ia),this._renderer.xr.enabled=Pa,t.scissorTest=!1,ar(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Gi||t.mapping===Wi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Ra=this._renderer.getRenderTarget(),Ca=this._renderer.getActiveCubeFace(),Ia=this._renderer.getActiveMipmapLevel(),Pa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Le,minFilter:Le,generateMipmaps:!1,type:Ue,format:on,colorSpace:qn,depthBuffer:!1},s=cc(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=cc(t,e,n);let{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Pp(r)),this._blurMaterial=Lp(r,t,e)}return s}_compileMaterial(t){let e=new Vt(this._lodPlanes[0],t);this._renderer.compile(e,Aa)}_sceneToCubeUV(t,e,n,s){let o=new Pe(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(oc),h.toneMapping=Vn,h.autoClear=!1;let p=new pn({name:"PMREM.Background",side:He,depthWrite:!1,depthTest:!1}),g=new Vt(new Ze,p),M=!1,m=t.background;m?m.isColor&&(p.color.copy(m),t.background=null,M=!0):(p.color.copy(oc),M=!0);for(let f=0;f<6;f++){let E=f%3;E===0?(o.up.set(0,l[f],0),o.lookAt(c[f],0,0)):E===1?(o.up.set(0,0,l[f]),o.lookAt(0,c[f],0)):(o.up.set(0,l[f],0),o.lookAt(0,0,c[f]));let S=this._cubeSize;ar(s,E*S,f>2?S:0,S,S),h.setRenderTarget(s),M&&h.render(g,o),h.render(t,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===Gi||t.mapping===Wi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=uc()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=hc());let r=s?this._cubemapMaterial:this._equirectMaterial,a=new Vt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;let l=this._cubeSize;ar(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Aa)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodPlanes.length;for(let r=1;r<s;r++){let a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=lc[(s-r-1)%lc.length];this._blur(t,r-1,r,a,o)}e.autoClear=n}_blur(t,e,n,s,r){let a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=3,u=new Vt(this._lodPlanes[s],c),d=c.uniforms,p=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*ai-1),M=r/g,m=isFinite(r)?1+Math.floor(h*M):ai;m>ai&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${ai}`);let f=[],E=0;for(let I=0;I<ai;++I){let A=I/M,b=Math.exp(-A*A/2);f.push(b),I===0?E+=b:I<m&&(E+=2*b)}for(let I=0;I<f.length;I++)f[I]=f[I]/E;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);let{_lodMax:S}=this;d.dTheta.value=g,d.mipInt.value=S-n;let x=this._sizeLods[s],O=3*x*(s>S-Fi?s-S+Fi:0),R=4*(this._cubeSize-x);ar(e,O,R,3*x,2*x),l.setRenderTarget(e),l.render(u,Aa)}};function Pp(i){let t=[],e=[],n=[],s=i,r=i-Fi+1+ac.length;for(let a=0;a<r;a++){let o=Math.pow(2,s);e.push(o);let l=1/o;a>i-Fi?l=ac[a-i+Fi-1]:a===0&&(l=0),n.push(l);let c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,M=3,m=2,f=1,E=new Float32Array(M*g*p),S=new Float32Array(m*g*p),x=new Float32Array(f*g*p);for(let R=0;R<p;R++){let I=R%3*2/3-1,A=R>2?0:-1,b=[I,A,0,I+2/3,A,0,I+2/3,A+1,0,I,A,0,I+2/3,A+1,0,I,A+1,0];E.set(b,M*g*R),S.set(d,m*g*R);let y=[R,R,R,R,R,R];x.set(y,f*g*R)}let O=new De;O.setAttribute("position",new je(E,M)),O.setAttribute("uv",new je(S,m)),O.setAttribute("faceIndex",new je(x,f)),t.push(O),s>Fi&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function cc(i,t,e){let n=new Be(i,t,e);return n.texture.mapping=Yr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function ar(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function Lp(i,t,e){let n=new Float32Array(ai),s=new P(0,1,0);return new Ee({name:"SphericalGaussianBlur",defines:{n:ai,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:bl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:dn,depthTest:!1,depthWrite:!1})}function hc(){return new Ee({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:bl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:dn,depthTest:!1,depthWrite:!1})}function uc(){return new Ee({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:bl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:dn,depthTest:!1,depthWrite:!1})}function bl(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Dp(i){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){let l=o.mapping,c=l===Ya||l===Za,h=l===Gi||l===Wi;if(c||h){let u=t.get(o),d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new $i(i)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{let p=o.image;return c&&p&&p.height>0||h&&p&&s(p)?(e===null&&(e=new $i(i)),u=c?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function s(o){let l=0,c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){let l=o.target;l.removeEventListener("dispose",r);let c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function Up(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&cs("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Np(i,t,e,n){let s={},r=new WeakMap;function a(u){let d=u.target;d.index!==null&&t.remove(d.index);for(let g in d.attributes)t.remove(d.attributes[g]);for(let g in d.morphAttributes){let M=d.morphAttributes[g];for(let m=0,f=M.length;m<f;m++)t.remove(M[m])}d.removeEventListener("dispose",a),delete s[d.id];let p=r.get(d);p&&(t.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,e.memory.geometries++),d}function l(u){let d=u.attributes;for(let g in d)t.update(d[g],i.ARRAY_BUFFER);let p=u.morphAttributes;for(let g in p){let M=p[g];for(let m=0,f=M.length;m<f;m++)t.update(M[m],i.ARRAY_BUFFER)}}function c(u){let d=[],p=u.index,g=u.attributes.position,M=0;if(p!==null){let E=p.array;M=p.version;for(let S=0,x=E.length;S<x;S+=3){let O=E[S+0],R=E[S+1],I=E[S+2];d.push(O,R,R,I,I,O)}}else if(g!==void 0){let E=g.array;M=g.version;for(let S=0,x=E.length/3-1;S<x;S+=3){let O=S+0,R=S+1,I=S+2;d.push(O,R,R,I,I,O)}}else return;let m=new(eh(d)?Er:br)(d,1);m.version=M;let f=r.get(u);f&&t.remove(f),r.set(u,m)}function h(u){let d=r.get(u);if(d){let p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Fp(i,t,e){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,p){i.drawElements(n,p,r,d*a),e.update(p,n,1)}function c(d,p,g){g!==0&&(i.drawElementsInstanced(n,p,r,d*a,g),e.update(p,n,g))}function h(d,p,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,d,0,g);let m=0;for(let f=0;f<g;f++)m+=p[f];e.update(m,n,1)}function u(d,p,g,M){if(g===0)return;let m=t.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<d.length;f++)c(d[f]/a,p[f],M[f]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,d,0,M,0,g);let f=0;for(let E=0;E<g;E++)f+=p[E]*M[E];e.update(f,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Op(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Bp(i,t,e){let n=new WeakMap,s=new he;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0,d=n.get(o);if(d===void 0||d.count!==u){let b=function(){I.dispose(),n.delete(o),o.removeEventListener("dispose",b)};d!==void 0&&d.texture.dispose();let p=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,M=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],E=o.morphAttributes.color||[],S=0;p===!0&&(S=1),g===!0&&(S=2),M===!0&&(S=3);let x=o.attributes.position.count*S,O=1;x>t.maxTextureSize&&(O=Math.ceil(x/t.maxTextureSize),x=t.maxTextureSize);let R=new Float32Array(x*O*4*u),I=new Mr(R,x,O,u);I.type=qe,I.needsUpdate=!0;let A=S*4;for(let y=0;y<u;y++){let C=m[y],H=f[y],B=E[y],z=x*O*4*y;for(let W=0;W<C.count;W++){let k=W*A;p===!0&&(s.fromBufferAttribute(C,W),R[z+k+0]=s.x,R[z+k+1]=s.y,R[z+k+2]=s.z,R[z+k+3]=0),g===!0&&(s.fromBufferAttribute(H,W),R[z+k+4]=s.x,R[z+k+5]=s.y,R[z+k+6]=s.z,R[z+k+7]=0),M===!0&&(s.fromBufferAttribute(B,W),R[z+k+8]=s.x,R[z+k+9]=s.y,R[z+k+10]=s.z,R[z+k+11]=B.itemSize===4?s.w:1)}}d={count:u,texture:I,size:new it(x,O)},n.set(o,d),o.addEventListener("dispose",b)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let p=0;for(let M=0;M<c.length;M++)p+=c[M];let g=o.morphTargetsRelative?1:1-p;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function zp(i,t,e,n){let s=new WeakMap;function r(l){let c=n.render.frame,h=l.geometry,u=t.get(l,h);if(s.get(u)!==c&&(t.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){let d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return u}function a(){s=new WeakMap}function o(l){let c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}var Ar=class extends Oe{constructor(t,e,n,s,r,a,o,l,c,h=zi){if(h!==zi&&h!==qi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===zi&&(n=oi),n===void 0&&h===qi&&(n=Xi),super(null,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Ye,this.minFilter=l!==void 0?l:Ye,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}},rh=new Oe,dc=new Ar(1,1),ah=new Mr,oh=new wo,lh=new wr,fc=[],pc=[],mc=new Float32Array(16),gc=new Float32Array(9),_c=new Float32Array(4);function ji(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=fc[s];if(r===void 0&&(r=new Float32Array(s),fc[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function Te(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function we(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function $r(i,t){let e=pc[t];e===void 0&&(e=new Int32Array(t),pc[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function kp(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Hp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2fv(this.addr,t),we(e,t)}}function Vp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Te(e,t))return;i.uniform3fv(this.addr,t),we(e,t)}}function Gp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4fv(this.addr,t),we(e,t)}}function Wp(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),we(e,t)}else{if(Te(e,n))return;_c.set(n),i.uniformMatrix2fv(this.addr,!1,_c),we(e,n)}}function Xp(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),we(e,t)}else{if(Te(e,n))return;gc.set(n),i.uniformMatrix3fv(this.addr,!1,gc),we(e,n)}}function qp(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),we(e,t)}else{if(Te(e,n))return;mc.set(n),i.uniformMatrix4fv(this.addr,!1,mc),we(e,n)}}function Yp(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Zp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2iv(this.addr,t),we(e,t)}}function $p(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3iv(this.addr,t),we(e,t)}}function Jp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4iv(this.addr,t),we(e,t)}}function Kp(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Qp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2uiv(this.addr,t),we(e,t)}}function jp(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3uiv(this.addr,t),we(e,t)}}function tm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4uiv(this.addr,t),we(e,t)}}function em(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(dc.compareFunction=th,r=dc):r=rh,e.setTexture2D(t||r,s)}function nm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||oh,s)}function im(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||lh,s)}function sm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||ah,s)}function rm(i){switch(i){case 5126:return kp;case 35664:return Hp;case 35665:return Vp;case 35666:return Gp;case 35674:return Wp;case 35675:return Xp;case 35676:return qp;case 5124:case 35670:return Yp;case 35667:case 35671:return Zp;case 35668:case 35672:return $p;case 35669:case 35673:return Jp;case 5125:return Kp;case 36294:return Qp;case 36295:return jp;case 36296:return tm;case 35678:case 36198:case 36298:case 36306:case 35682:return em;case 35679:case 36299:case 36307:return nm;case 35680:case 36300:case 36308:case 36293:return im;case 36289:case 36303:case 36311:case 36292:return sm}}function am(i,t){i.uniform1fv(this.addr,t)}function om(i,t){let e=ji(t,this.size,2);i.uniform2fv(this.addr,e)}function lm(i,t){let e=ji(t,this.size,3);i.uniform3fv(this.addr,e)}function cm(i,t){let e=ji(t,this.size,4);i.uniform4fv(this.addr,e)}function hm(i,t){let e=ji(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function um(i,t){let e=ji(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function dm(i,t){let e=ji(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function fm(i,t){i.uniform1iv(this.addr,t)}function pm(i,t){i.uniform2iv(this.addr,t)}function mm(i,t){i.uniform3iv(this.addr,t)}function gm(i,t){i.uniform4iv(this.addr,t)}function _m(i,t){i.uniform1uiv(this.addr,t)}function xm(i,t){i.uniform2uiv(this.addr,t)}function vm(i,t){i.uniform3uiv(this.addr,t)}function ym(i,t){i.uniform4uiv(this.addr,t)}function Mm(i,t,e){let n=this.cache,s=t.length,r=$r(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),we(n,r));for(let a=0;a!==s;++a)e.setTexture2D(t[a]||rh,r[a])}function Sm(i,t,e){let n=this.cache,s=t.length,r=$r(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),we(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||oh,r[a])}function bm(i,t,e){let n=this.cache,s=t.length,r=$r(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),we(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||lh,r[a])}function Em(i,t,e){let n=this.cache,s=t.length,r=$r(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),we(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||ah,r[a])}function Tm(i){switch(i){case 5126:return am;case 35664:return om;case 35665:return lm;case 35666:return cm;case 35674:return hm;case 35675:return um;case 35676:return dm;case 5124:case 35670:return fm;case 35667:case 35671:return pm;case 35668:case 35672:return mm;case 35669:case 35673:return gm;case 5125:return _m;case 36294:return xm;case 36295:return vm;case 36296:return ym;case 35678:case 36198:case 36298:case 36306:case 35682:return Mm;case 35679:case 36299:case 36307:return Sm;case 35680:case 36300:case 36308:case 36293:return bm;case 36289:case 36303:case 36311:case 36292:return Em}}var Co=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=rm(e.type)}},Io=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Tm(e.type)}},Po=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(t,e[o.id],n)}}},La=/(\w+)(\])?(\[|\.)?/g;function xc(i,t){i.seq.push(t),i.map[t.id]=t}function wm(i,t,e){let n=i.name,s=n.length;for(La.lastIndex=0;;){let r=La.exec(n),a=La.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){xc(e,c===void 0?new Co(o,i,t):new Io(o,i,t));break}else{let u=e.map[o];u===void 0&&(u=new Po(o),xc(e,u)),e=u}}}var Hi=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){let r=t.getActiveUniform(e,s),a=t.getUniformLocation(e,r.name);wm(r,a,this)}}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){let o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let a=t[s];a.id in e&&n.push(a)}return n}};function vc(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var Am=37297,Rm=0;function Cm(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}var yc=new Qt;function Im(i){ie._getMatrix(yc,ie.workingColorSpace,i);let t=`mat3( ${yc.elements.map(e=>e.toFixed(4))} )`;switch(ie.getTransfer(i)){case Zr:return[t,"LinearTransferOETF"];case le:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Mc(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";let r=/ERROR: 0:(\d+)/.exec(s);if(r){let a=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+Cm(i.getShaderSource(t),a)}else return s}function Pm(i,t){let e=Im(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Lm(i,t){let e;switch(t){case hl:e="Linear";break;case ul:e="Reinhard";break;case dl:e="Cineon";break;case Fs:e="ACESFilmic";break;case fl:e="AgX";break;case pl:e="Neutral";break;case Xh:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var or=new P;function Dm(){ie.getLuminanceCoefficients(or);let i=or.x.toFixed(4),t=or.y.toFixed(4),e=or.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Um(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(hs).join(`
`)}function Nm(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Fm(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function hs(i){return i!==""}function Sc(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function bc(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Om=/^[ \t]*#include +<([\w\d./]+)>/gm;function Lo(i){return i.replace(Om,zm)}var Bm=new Map;function zm(i,t){let e=jt[t];if(e===void 0){let n=Bm.get(t);if(n!==void 0)e=jt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return Lo(e)}var km=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ec(i){return i.replace(km,Hm)}function Hm(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Tc(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Vm(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===kc?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===cl?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===bn&&(t="SHADOWMAP_TYPE_VSM"),t}function Gm(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Gi:case Wi:t="ENVMAP_TYPE_CUBE";break;case Yr:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Wm(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case Wi:t="ENVMAP_MODE_REFRACTION";break}return t}function Xm(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Hc:t="ENVMAP_BLENDING_MULTIPLY";break;case Gh:t="ENVMAP_BLENDING_MIX";break;case Wh:t="ENVMAP_BLENDING_ADD";break}return t}function qm(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function Ym(i,t,e,n){let s=i.getContext(),r=e.defines,a=e.vertexShader,o=e.fragmentShader,l=Vm(e),c=Gm(e),h=Wm(e),u=Xm(e),d=qm(e),p=Um(e),g=Nm(r),M=s.createProgram(),m,f,E=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(hs).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(hs).join(`
`),f.length>0&&(f+=`
`)):(m=[Tc(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(hs).join(`
`),f=[Tc(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Vn?"#define TONE_MAPPING":"",e.toneMapping!==Vn?jt.tonemapping_pars_fragment:"",e.toneMapping!==Vn?Lm("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",jt.colorspace_pars_fragment,Pm("linearToOutputTexel",e.outputColorSpace),Dm(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(hs).join(`
`)),a=Lo(a),a=Sc(a,e),a=bc(a,e),o=Lo(o),o=Sc(o,e),o=bc(o,e),a=Ec(a),o=Ec(o),e.isRawShaderMaterial!==!0&&(E=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",e.glslVersion===Bl?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Bl?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let S=E+m+a,x=E+f+o,O=vc(s,s.VERTEX_SHADER,S),R=vc(s,s.FRAGMENT_SHADER,x);s.attachShader(M,O),s.attachShader(M,R),e.index0AttributeName!==void 0?s.bindAttribLocation(M,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(M,0,"position"),s.linkProgram(M);function I(C){if(i.debug.checkShaderErrors){let H=s.getProgramInfoLog(M).trim(),B=s.getShaderInfoLog(O).trim(),z=s.getShaderInfoLog(R).trim(),W=!0,k=!0;if(s.getProgramParameter(M,s.LINK_STATUS)===!1)if(W=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,M,O,R);else{let at=Mc(s,O,"vertex"),G=Mc(s,R,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(M,s.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+H+`
`+at+`
`+G)}else H!==""?console.warn("THREE.WebGLProgram: Program Info Log:",H):(B===""||z==="")&&(k=!1);k&&(C.diagnostics={runnable:W,programLog:H,vertexShader:{log:B,prefix:m},fragmentShader:{log:z,prefix:f}})}s.deleteShader(O),s.deleteShader(R),A=new Hi(s,M),b=Fm(s,M)}let A;this.getUniforms=function(){return A===void 0&&I(this),A};let b;this.getAttributes=function(){return b===void 0&&I(this),b};let y=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=s.getProgramParameter(M,Am)),y},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(M),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Rm++,this.cacheKey=t,this.usedTimes=1,this.program=M,this.vertexShader=O,this.fragmentShader=R,this}var Zm=0,Do=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){let e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new Uo(t),e.set(t,n)),n}},Uo=class{constructor(t){this.id=Zm++,this.code=t,this.usedTimes=0}};function $m(i,t,e,n,s,r,a){let o=new Ss,l=new Do,c=new Set,h=[],u=s.logarithmicDepthBuffer,d=s.vertexTextures,p=s.precision,g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function M(b){return c.add(b),b===0?"uv":`uv${b}`}function m(b,y,C,H,B){let z=H.fog,W=B.geometry,k=b.isMeshStandardMaterial?H.environment:null,at=(b.isMeshStandardMaterial?e:t).get(b.envMap||k),G=at&&at.mapping===Yr?at.image.height:null,dt=g[b.type];b.precision!==null&&(p=s.getMaxPrecision(b.precision),p!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",p,"instead."));let ft=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,Rt=ft!==void 0?ft.length:0,Ft=0;W.morphAttributes.position!==void 0&&(Ft=1),W.morphAttributes.normal!==void 0&&(Ft=2),W.morphAttributes.color!==void 0&&(Ft=3);let Zt,$,ct,Tt;if(dt){let ne=un[dt];Zt=ne.vertexShader,$=ne.fragmentShader}else Zt=b.vertexShader,$=b.fragmentShader,l.update(b),ct=l.getVertexShaderID(b),Tt=l.getFragmentShaderID(b);let lt=i.getRenderTarget(),Bt=i.state.buffers.depth.getReversed(),Ht=B.isInstancedMesh===!0,Gt=B.isBatchedMesh===!0,te=!!b.map,j=!!b.matcap,ht=!!at,w=!!b.aoMap,Ut=!!b.lightMap,ot=!!b.bumpMap,bt=!!b.normalMap,ut=!!b.displacementMap,kt=!!b.emissiveMap,wt=!!b.metalnessMap,T=!!b.roughnessMap,v=b.anisotropy>0,V=b.clearcoat>0,J=b.dispersion>0,nt=b.iridescence>0,K=b.sheen>0,Ct=b.transmission>0,yt=v&&!!b.anisotropyMap,gt=V&&!!b.clearcoatMap,$t=V&&!!b.clearcoatNormalMap,st=V&&!!b.clearcoatRoughnessMap,At=nt&&!!b.iridescenceMap,zt=nt&&!!b.iridescenceThicknessMap,qt=K&&!!b.sheenColorMap,xt=K&&!!b.sheenRoughnessMap,ee=!!b.specularMap,Kt=!!b.specularColorMap,ce=!!b.specularIntensityMap,N=Ct&&!!b.transmissionMap,St=Ct&&!!b.thicknessMap,q=!!b.gradientMap,Q=!!b.alphaMap,vt=b.alphaTest>0,mt=!!b.alphaHash,Xt=!!b.extensions,ue=Vn;b.toneMapped&&(lt===null||lt.isXRRenderTarget===!0)&&(ue=i.toneMapping);let Me={shaderID:dt,shaderType:b.type,shaderName:b.name,vertexShader:Zt,fragmentShader:$,defines:b.defines,customVertexShaderID:ct,customFragmentShaderID:Tt,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:p,batching:Gt,batchingColor:Gt&&B._colorsTexture!==null,instancing:Ht,instancingColor:Ht&&B.instanceColor!==null,instancingMorph:Ht&&B.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:lt===null?i.outputColorSpace:lt.isXRRenderTarget===!0?lt.texture.colorSpace:qn,alphaToCoverage:!!b.alphaToCoverage,map:te,matcap:j,envMap:ht,envMapMode:ht&&at.mapping,envMapCubeUVHeight:G,aoMap:w,lightMap:Ut,bumpMap:ot,normalMap:bt,displacementMap:d&&ut,emissiveMap:kt,normalMapObjectSpace:bt&&b.normalMapType===$h,normalMapTangentSpace:bt&&b.normalMapType===jc,metalnessMap:wt,roughnessMap:T,anisotropy:v,anisotropyMap:yt,clearcoat:V,clearcoatMap:gt,clearcoatNormalMap:$t,clearcoatRoughnessMap:st,dispersion:J,iridescence:nt,iridescenceMap:At,iridescenceThicknessMap:zt,sheen:K,sheenColorMap:qt,sheenRoughnessMap:xt,specularMap:ee,specularColorMap:Kt,specularIntensityMap:ce,transmission:Ct,transmissionMap:N,thicknessMap:St,gradientMap:q,opaque:b.transparent===!1&&b.blending===Bi&&b.alphaToCoverage===!1,alphaMap:Q,alphaTest:vt,alphaHash:mt,combine:b.combine,mapUv:te&&M(b.map.channel),aoMapUv:w&&M(b.aoMap.channel),lightMapUv:Ut&&M(b.lightMap.channel),bumpMapUv:ot&&M(b.bumpMap.channel),normalMapUv:bt&&M(b.normalMap.channel),displacementMapUv:ut&&M(b.displacementMap.channel),emissiveMapUv:kt&&M(b.emissiveMap.channel),metalnessMapUv:wt&&M(b.metalnessMap.channel),roughnessMapUv:T&&M(b.roughnessMap.channel),anisotropyMapUv:yt&&M(b.anisotropyMap.channel),clearcoatMapUv:gt&&M(b.clearcoatMap.channel),clearcoatNormalMapUv:$t&&M(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:st&&M(b.clearcoatRoughnessMap.channel),iridescenceMapUv:At&&M(b.iridescenceMap.channel),iridescenceThicknessMapUv:zt&&M(b.iridescenceThicknessMap.channel),sheenColorMapUv:qt&&M(b.sheenColorMap.channel),sheenRoughnessMapUv:xt&&M(b.sheenRoughnessMap.channel),specularMapUv:ee&&M(b.specularMap.channel),specularColorMapUv:Kt&&M(b.specularColorMap.channel),specularIntensityMapUv:ce&&M(b.specularIntensityMap.channel),transmissionMapUv:N&&M(b.transmissionMap.channel),thicknessMapUv:St&&M(b.thicknessMap.channel),alphaMapUv:Q&&M(b.alphaMap.channel),vertexTangents:!!W.attributes.tangent&&(bt||v),vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!W.attributes.uv&&(te||Q),fog:!!z,useFog:b.fog===!0,fogExp2:!!z&&z.isFogExp2,flatShading:b.flatShading===!0,sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Bt,skinning:B.isSkinnedMesh===!0,morphTargets:W.morphAttributes.position!==void 0,morphNormals:W.morphAttributes.normal!==void 0,morphColors:W.morphAttributes.color!==void 0,morphTargetsCount:Rt,morphTextureStride:Ft,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:b.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:ue,decodeVideoTexture:te&&b.map.isVideoTexture===!0&&ie.getTransfer(b.map.colorSpace)===le,decodeVideoTextureEmissive:kt&&b.emissiveMap.isVideoTexture===!0&&ie.getTransfer(b.emissiveMap.colorSpace)===le,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===Tn,flipSided:b.side===He,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:Xt&&b.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Xt&&b.extensions.multiDraw===!0||Gt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Me.vertexUv1s=c.has(1),Me.vertexUv2s=c.has(2),Me.vertexUv3s=c.has(3),c.clear(),Me}function f(b){let y=[];if(b.shaderID?y.push(b.shaderID):(y.push(b.customVertexShaderID),y.push(b.customFragmentShaderID)),b.defines!==void 0)for(let C in b.defines)y.push(C),y.push(b.defines[C]);return b.isRawShaderMaterial===!1&&(E(y,b),S(y,b),y.push(i.outputColorSpace)),y.push(b.customProgramCacheKey),y.join()}function E(b,y){b.push(y.precision),b.push(y.outputColorSpace),b.push(y.envMapMode),b.push(y.envMapCubeUVHeight),b.push(y.mapUv),b.push(y.alphaMapUv),b.push(y.lightMapUv),b.push(y.aoMapUv),b.push(y.bumpMapUv),b.push(y.normalMapUv),b.push(y.displacementMapUv),b.push(y.emissiveMapUv),b.push(y.metalnessMapUv),b.push(y.roughnessMapUv),b.push(y.anisotropyMapUv),b.push(y.clearcoatMapUv),b.push(y.clearcoatNormalMapUv),b.push(y.clearcoatRoughnessMapUv),b.push(y.iridescenceMapUv),b.push(y.iridescenceThicknessMapUv),b.push(y.sheenColorMapUv),b.push(y.sheenRoughnessMapUv),b.push(y.specularMapUv),b.push(y.specularColorMapUv),b.push(y.specularIntensityMapUv),b.push(y.transmissionMapUv),b.push(y.thicknessMapUv),b.push(y.combine),b.push(y.fogExp2),b.push(y.sizeAttenuation),b.push(y.morphTargetsCount),b.push(y.morphAttributeCount),b.push(y.numDirLights),b.push(y.numPointLights),b.push(y.numSpotLights),b.push(y.numSpotLightMaps),b.push(y.numHemiLights),b.push(y.numRectAreaLights),b.push(y.numDirLightShadows),b.push(y.numPointLightShadows),b.push(y.numSpotLightShadows),b.push(y.numSpotLightShadowsWithMaps),b.push(y.numLightProbes),b.push(y.shadowMapType),b.push(y.toneMapping),b.push(y.numClippingPlanes),b.push(y.numClipIntersection),b.push(y.depthPacking)}function S(b,y){o.disableAll(),y.supportsVertexTextures&&o.enable(0),y.instancing&&o.enable(1),y.instancingColor&&o.enable(2),y.instancingMorph&&o.enable(3),y.matcap&&o.enable(4),y.envMap&&o.enable(5),y.normalMapObjectSpace&&o.enable(6),y.normalMapTangentSpace&&o.enable(7),y.clearcoat&&o.enable(8),y.iridescence&&o.enable(9),y.alphaTest&&o.enable(10),y.vertexColors&&o.enable(11),y.vertexAlphas&&o.enable(12),y.vertexUv1s&&o.enable(13),y.vertexUv2s&&o.enable(14),y.vertexUv3s&&o.enable(15),y.vertexTangents&&o.enable(16),y.anisotropy&&o.enable(17),y.alphaHash&&o.enable(18),y.batching&&o.enable(19),y.dispersion&&o.enable(20),y.batchingColor&&o.enable(21),b.push(o.mask),o.disableAll(),y.fog&&o.enable(0),y.useFog&&o.enable(1),y.flatShading&&o.enable(2),y.logarithmicDepthBuffer&&o.enable(3),y.reverseDepthBuffer&&o.enable(4),y.skinning&&o.enable(5),y.morphTargets&&o.enable(6),y.morphNormals&&o.enable(7),y.morphColors&&o.enable(8),y.premultipliedAlpha&&o.enable(9),y.shadowMapEnabled&&o.enable(10),y.doubleSided&&o.enable(11),y.flipSided&&o.enable(12),y.useDepthPacking&&o.enable(13),y.dithering&&o.enable(14),y.transmission&&o.enable(15),y.sheen&&o.enable(16),y.opaque&&o.enable(17),y.pointsUvs&&o.enable(18),y.decodeVideoTexture&&o.enable(19),y.decodeVideoTextureEmissive&&o.enable(20),y.alphaToCoverage&&o.enable(21),b.push(o.mask)}function x(b){let y=g[b.type],C;if(y){let H=un[y];C=Yn.clone(H.uniforms)}else C=b.uniforms;return C}function O(b,y){let C;for(let H=0,B=h.length;H<B;H++){let z=h[H];if(z.cacheKey===y){C=z,++C.usedTimes;break}}return C===void 0&&(C=new Ym(i,y,b,r),h.push(C)),C}function R(b){if(--b.usedTimes===0){let y=h.indexOf(b);h[y]=h[h.length-1],h.pop(),b.destroy()}}function I(b){l.remove(b)}function A(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:x,acquireProgram:O,releaseProgram:R,releaseShaderCache:I,programs:h,dispose:A}}function Jm(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Km(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function wc(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Ac(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(u,d,p,g,M,m){let f=i[t];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:g,renderOrder:u.renderOrder,z:M,group:m},i[t]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=M,f.group=m),t++,f}function o(u,d,p,g,M,m){let f=a(u,d,p,g,M,m);p.transmission>0?n.push(f):p.transparent===!0?s.push(f):e.push(f)}function l(u,d,p,g,M,m){let f=a(u,d,p,g,M,m);p.transmission>0?n.unshift(f):p.transparent===!0?s.unshift(f):e.unshift(f)}function c(u,d){e.length>1&&e.sort(u||Km),n.length>1&&n.sort(d||wc),s.length>1&&s.sort(d||wc)}function h(){for(let u=t,d=i.length;u<d;u++){let p=i[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:h,sort:c}}function Qm(){let i=new WeakMap;function t(n,s){let r=i.get(n),a;return r===void 0?(a=new Ac,i.set(n,[a])):s>=r.length?(a=new Ac,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function jm(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new P,color:new Wt};break;case"SpotLight":e={position:new P,direction:new P,color:new Wt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new P,color:new Wt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new P,skyColor:new Wt,groundColor:new Wt};break;case"RectAreaLight":e={color:new Wt,position:new P,halfWidth:new P,halfHeight:new P};break}return i[t.id]=e,e}}}function tg(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new it};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new it};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new it,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var eg=0;function ng(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function ig(i){let t=new jm,e=tg(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new P);let s=new P,r=new _e,a=new _e;function o(c){let h=0,u=0,d=0;for(let b=0;b<9;b++)n.probe[b].set(0,0,0);let p=0,g=0,M=0,m=0,f=0,E=0,S=0,x=0,O=0,R=0,I=0;c.sort(ng);for(let b=0,y=c.length;b<y;b++){let C=c[b],H=C.color,B=C.intensity,z=C.distance,W=C.shadow&&C.shadow.map?C.shadow.map.texture:null;if(C.isAmbientLight)h+=H.r*B,u+=H.g*B,d+=H.b*B;else if(C.isLightProbe){for(let k=0;k<9;k++)n.probe[k].addScaledVector(C.sh.coefficients[k],B);I++}else if(C.isDirectionalLight){let k=t.get(C);if(k.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let at=C.shadow,G=e.get(C);G.shadowIntensity=at.intensity,G.shadowBias=at.bias,G.shadowNormalBias=at.normalBias,G.shadowRadius=at.radius,G.shadowMapSize=at.mapSize,n.directionalShadow[p]=G,n.directionalShadowMap[p]=W,n.directionalShadowMatrix[p]=C.shadow.matrix,E++}n.directional[p]=k,p++}else if(C.isSpotLight){let k=t.get(C);k.position.setFromMatrixPosition(C.matrixWorld),k.color.copy(H).multiplyScalar(B),k.distance=z,k.coneCos=Math.cos(C.angle),k.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),k.decay=C.decay,n.spot[M]=k;let at=C.shadow;if(C.map&&(n.spotLightMap[O]=C.map,O++,at.updateMatrices(C),C.castShadow&&R++),n.spotLightMatrix[M]=at.matrix,C.castShadow){let G=e.get(C);G.shadowIntensity=at.intensity,G.shadowBias=at.bias,G.shadowNormalBias=at.normalBias,G.shadowRadius=at.radius,G.shadowMapSize=at.mapSize,n.spotShadow[M]=G,n.spotShadowMap[M]=W,x++}M++}else if(C.isRectAreaLight){let k=t.get(C);k.color.copy(H).multiplyScalar(B),k.halfWidth.set(C.width*.5,0,0),k.halfHeight.set(0,C.height*.5,0),n.rectArea[m]=k,m++}else if(C.isPointLight){let k=t.get(C);if(k.color.copy(C.color).multiplyScalar(C.intensity),k.distance=C.distance,k.decay=C.decay,C.castShadow){let at=C.shadow,G=e.get(C);G.shadowIntensity=at.intensity,G.shadowBias=at.bias,G.shadowNormalBias=at.normalBias,G.shadowRadius=at.radius,G.shadowMapSize=at.mapSize,G.shadowCameraNear=at.camera.near,G.shadowCameraFar=at.camera.far,n.pointShadow[g]=G,n.pointShadowMap[g]=W,n.pointShadowMatrix[g]=C.shadow.matrix,S++}n.point[g]=k,g++}else if(C.isHemisphereLight){let k=t.get(C);k.skyColor.copy(C.color).multiplyScalar(B),k.groundColor.copy(C.groundColor).multiplyScalar(B),n.hemi[f]=k,f++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Mt.LTC_FLOAT_1,n.rectAreaLTC2=Mt.LTC_FLOAT_2):(n.rectAreaLTC1=Mt.LTC_HALF_1,n.rectAreaLTC2=Mt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;let A=n.hash;(A.directionalLength!==p||A.pointLength!==g||A.spotLength!==M||A.rectAreaLength!==m||A.hemiLength!==f||A.numDirectionalShadows!==E||A.numPointShadows!==S||A.numSpotShadows!==x||A.numSpotMaps!==O||A.numLightProbes!==I)&&(n.directional.length=p,n.spot.length=M,n.rectArea.length=m,n.point.length=g,n.hemi.length=f,n.directionalShadow.length=E,n.directionalShadowMap.length=E,n.pointShadow.length=S,n.pointShadowMap.length=S,n.spotShadow.length=x,n.spotShadowMap.length=x,n.directionalShadowMatrix.length=E,n.pointShadowMatrix.length=S,n.spotLightMatrix.length=x+O-R,n.spotLightMap.length=O,n.numSpotLightShadowsWithMaps=R,n.numLightProbes=I,A.directionalLength=p,A.pointLength=g,A.spotLength=M,A.rectAreaLength=m,A.hemiLength=f,A.numDirectionalShadows=E,A.numPointShadows=S,A.numSpotShadows=x,A.numSpotMaps=O,A.numLightProbes=I,n.version=eg++)}function l(c,h){let u=0,d=0,p=0,g=0,M=0,m=h.matrixWorldInverse;for(let f=0,E=c.length;f<E;f++){let S=c[f];if(S.isDirectionalLight){let x=n.directional[u];x.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),x.direction.sub(s),x.direction.transformDirection(m),u++}else if(S.isSpotLight){let x=n.spot[p];x.position.setFromMatrixPosition(S.matrixWorld),x.position.applyMatrix4(m),x.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),x.direction.sub(s),x.direction.transformDirection(m),p++}else if(S.isRectAreaLight){let x=n.rectArea[g];x.position.setFromMatrixPosition(S.matrixWorld),x.position.applyMatrix4(m),a.identity(),r.copy(S.matrixWorld),r.premultiply(m),a.extractRotation(r),x.halfWidth.set(S.width*.5,0,0),x.halfHeight.set(0,S.height*.5,0),x.halfWidth.applyMatrix4(a),x.halfHeight.applyMatrix4(a),g++}else if(S.isPointLight){let x=n.point[d];x.position.setFromMatrixPosition(S.matrixWorld),x.position.applyMatrix4(m),d++}else if(S.isHemisphereLight){let x=n.hemi[M];x.direction.setFromMatrixPosition(S.matrixWorld),x.direction.transformDirection(m),M++}}}return{setup:o,setupView:l,state:n}}function Rc(i){let t=new ig(i),e=[],n=[];function s(h){c.camera=h,e.length=0,n.length=0}function r(h){e.push(h)}function a(h){n.push(h)}function o(){t.setup(e)}function l(h){t.setupView(e,h)}let c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function sg(i){let t=new WeakMap;function e(s,r=0){let a=t.get(s),o;return a===void 0?(o=new Rc(i),t.set(s,[o])):r>=a.length?(o=new Rc(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}var No=class extends ci{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Yh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},Fo=class extends ci{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}},rg=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,ag=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function og(i,t,e){let n=new bs,s=new it,r=new it,a=new he,o=new No({depthPacking:Zh}),l=new Fo,c={},h=e.maxTextureSize,u={[Gn]:He,[He]:Gn,[Tn]:Tn},d=new Ee({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new it},radius:{value:4}},vertexShader:rg,fragmentShader:ag}),p=d.clone();p.defines.HORIZONTAL_PASS=1;let g=new De;g.setAttribute("position",new je(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let M=new Vt(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=kc;let f=this.type;this.render=function(R,I,A){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||R.length===0)return;let b=i.getRenderTarget(),y=i.getActiveCubeFace(),C=i.getActiveMipmapLevel(),H=i.state;H.setBlending(dn),H.buffers.color.setClear(1,1,1,1),H.buffers.depth.setTest(!0),H.setScissorTest(!1);let B=f!==bn&&this.type===bn,z=f===bn&&this.type!==bn;for(let W=0,k=R.length;W<k;W++){let at=R[W],G=at.shadow;if(G===void 0){console.warn("THREE.WebGLShadowMap:",at,"has no shadow.");continue}if(G.autoUpdate===!1&&G.needsUpdate===!1)continue;s.copy(G.mapSize);let dt=G.getFrameExtents();if(s.multiply(dt),r.copy(G.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/dt.x),s.x=r.x*dt.x,G.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/dt.y),s.y=r.y*dt.y,G.mapSize.y=r.y)),G.map===null||B===!0||z===!0){let Rt=this.type!==bn?{minFilter:Ye,magFilter:Ye}:{};G.map!==null&&G.map.dispose(),G.map=new Be(s.x,s.y,Rt),G.map.texture.name=at.name+".shadowMap",G.camera.updateProjectionMatrix()}i.setRenderTarget(G.map),i.clear();let ft=G.getViewportCount();for(let Rt=0;Rt<ft;Rt++){let Ft=G.getViewport(Rt);a.set(r.x*Ft.x,r.y*Ft.y,r.x*Ft.z,r.y*Ft.w),H.viewport(a),G.updateMatrices(at,Rt),n=G.getFrustum(),x(I,A,G.camera,at,this.type)}G.isPointLightShadow!==!0&&this.type===bn&&E(G,A),G.needsUpdate=!1}f=this.type,m.needsUpdate=!1,i.setRenderTarget(b,y,C)};function E(R,I){let A=t.update(M);d.defines.VSM_SAMPLES!==R.blurSamples&&(d.defines.VSM_SAMPLES=R.blurSamples,p.defines.VSM_SAMPLES=R.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),R.mapPass===null&&(R.mapPass=new Be(s.x,s.y)),d.uniforms.shadow_pass.value=R.map.texture,d.uniforms.resolution.value=R.mapSize,d.uniforms.radius.value=R.radius,i.setRenderTarget(R.mapPass),i.clear(),i.renderBufferDirect(I,null,A,d,M,null),p.uniforms.shadow_pass.value=R.mapPass.texture,p.uniforms.resolution.value=R.mapSize,p.uniforms.radius.value=R.radius,i.setRenderTarget(R.map),i.clear(),i.renderBufferDirect(I,null,A,p,M,null)}function S(R,I,A,b){let y=null,C=A.isPointLight===!0?R.customDistanceMaterial:R.customDepthMaterial;if(C!==void 0)y=C;else if(y=A.isPointLight===!0?l:o,i.localClippingEnabled&&I.clipShadows===!0&&Array.isArray(I.clippingPlanes)&&I.clippingPlanes.length!==0||I.displacementMap&&I.displacementScale!==0||I.alphaMap&&I.alphaTest>0||I.map&&I.alphaTest>0){let H=y.uuid,B=I.uuid,z=c[H];z===void 0&&(z={},c[H]=z);let W=z[B];W===void 0&&(W=y.clone(),z[B]=W,I.addEventListener("dispose",O)),y=W}if(y.visible=I.visible,y.wireframe=I.wireframe,b===bn?y.side=I.shadowSide!==null?I.shadowSide:I.side:y.side=I.shadowSide!==null?I.shadowSide:u[I.side],y.alphaMap=I.alphaMap,y.alphaTest=I.alphaTest,y.map=I.map,y.clipShadows=I.clipShadows,y.clippingPlanes=I.clippingPlanes,y.clipIntersection=I.clipIntersection,y.displacementMap=I.displacementMap,y.displacementScale=I.displacementScale,y.displacementBias=I.displacementBias,y.wireframeLinewidth=I.wireframeLinewidth,y.linewidth=I.linewidth,A.isPointLight===!0&&y.isMeshDistanceMaterial===!0){let H=i.properties.get(y);H.light=A}return y}function x(R,I,A,b,y){if(R.visible===!1)return;if(R.layers.test(I.layers)&&(R.isMesh||R.isLine||R.isPoints)&&(R.castShadow||R.receiveShadow&&y===bn)&&(!R.frustumCulled||n.intersectsObject(R))){R.modelViewMatrix.multiplyMatrices(A.matrixWorldInverse,R.matrixWorld);let B=t.update(R),z=R.material;if(Array.isArray(z)){let W=B.groups;for(let k=0,at=W.length;k<at;k++){let G=W[k],dt=z[G.materialIndex];if(dt&&dt.visible){let ft=S(R,dt,b,y);R.onBeforeShadow(i,R,I,A,B,ft,G),i.renderBufferDirect(A,null,B,ft,R,G),R.onAfterShadow(i,R,I,A,B,ft,G)}}}else if(z.visible){let W=S(R,z,b,y);R.onBeforeShadow(i,R,I,A,B,W,null),i.renderBufferDirect(A,null,B,W,R,null),R.onAfterShadow(i,R,I,A,B,W,null)}}let H=R.children;for(let B=0,z=H.length;B<z;B++)x(H[B],I,A,b,y)}function O(R){R.target.removeEventListener("dispose",O);for(let A in c){let b=c[A],y=R.target.uuid;y in b&&(b[y].dispose(),delete b[y])}}}var lg={[ka]:Ha,[Va]:Xa,[Ga]:qa,[Vi]:Wa,[Ha]:ka,[Xa]:Va,[qa]:Ga,[Wa]:Vi};function cg(i,t){function e(){let N=!1,St=new he,q=null,Q=new he(0,0,0,0);return{setMask:function(vt){q!==vt&&!N&&(i.colorMask(vt,vt,vt,vt),q=vt)},setLocked:function(vt){N=vt},setClear:function(vt,mt,Xt,ue,Me){Me===!0&&(vt*=ue,mt*=ue,Xt*=ue),St.set(vt,mt,Xt,ue),Q.equals(St)===!1&&(i.clearColor(vt,mt,Xt,ue),Q.copy(St))},reset:function(){N=!1,q=null,Q.set(-1,0,0,0)}}}function n(){let N=!1,St=!1,q=null,Q=null,vt=null;return{setReversed:function(mt){if(St!==mt){let Xt=t.get("EXT_clip_control");St?Xt.clipControlEXT(Xt.LOWER_LEFT_EXT,Xt.ZERO_TO_ONE_EXT):Xt.clipControlEXT(Xt.LOWER_LEFT_EXT,Xt.NEGATIVE_ONE_TO_ONE_EXT);let ue=vt;vt=null,this.setClear(ue)}St=mt},getReversed:function(){return St},setTest:function(mt){mt?lt(i.DEPTH_TEST):Bt(i.DEPTH_TEST)},setMask:function(mt){q!==mt&&!N&&(i.depthMask(mt),q=mt)},setFunc:function(mt){if(St&&(mt=lg[mt]),Q!==mt){switch(mt){case ka:i.depthFunc(i.NEVER);break;case Ha:i.depthFunc(i.ALWAYS);break;case Va:i.depthFunc(i.LESS);break;case Vi:i.depthFunc(i.LEQUAL);break;case Ga:i.depthFunc(i.EQUAL);break;case Wa:i.depthFunc(i.GEQUAL);break;case Xa:i.depthFunc(i.GREATER);break;case qa:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}Q=mt}},setLocked:function(mt){N=mt},setClear:function(mt){vt!==mt&&(St&&(mt=1-mt),i.clearDepth(mt),vt=mt)},reset:function(){N=!1,q=null,Q=null,vt=null,St=!1}}}function s(){let N=!1,St=null,q=null,Q=null,vt=null,mt=null,Xt=null,ue=null,Me=null;return{setTest:function(ne){N||(ne?lt(i.STENCIL_TEST):Bt(i.STENCIL_TEST))},setMask:function(ne){St!==ne&&!N&&(i.stencilMask(ne),St=ne)},setFunc:function(ne,ze,de){(q!==ne||Q!==ze||vt!==de)&&(i.stencilFunc(ne,ze,de),q=ne,Q=ze,vt=de)},setOp:function(ne,ze,de){(mt!==ne||Xt!==ze||ue!==de)&&(i.stencilOp(ne,ze,de),mt=ne,Xt=ze,ue=de)},setLocked:function(ne){N=ne},setClear:function(ne){Me!==ne&&(i.clearStencil(ne),Me=ne)},reset:function(){N=!1,St=null,q=null,Q=null,vt=null,mt=null,Xt=null,ue=null,Me=null}}}let r=new e,a=new n,o=new s,l=new WeakMap,c=new WeakMap,h={},u={},d=new WeakMap,p=[],g=null,M=!1,m=null,f=null,E=null,S=null,x=null,O=null,R=null,I=new Wt(0,0,0),A=0,b=!1,y=null,C=null,H=null,B=null,z=null,W=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),k=!1,at=0,G=i.getParameter(i.VERSION);G.indexOf("WebGL")!==-1?(at=parseFloat(/^WebGL (\d)/.exec(G)[1]),k=at>=1):G.indexOf("OpenGL ES")!==-1&&(at=parseFloat(/^OpenGL ES (\d)/.exec(G)[1]),k=at>=2);let dt=null,ft={},Rt=i.getParameter(i.SCISSOR_BOX),Ft=i.getParameter(i.VIEWPORT),Zt=new he().fromArray(Rt),$=new he().fromArray(Ft);function ct(N,St,q,Q){let vt=new Uint8Array(4),mt=i.createTexture();i.bindTexture(N,mt),i.texParameteri(N,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(N,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Xt=0;Xt<q;Xt++)N===i.TEXTURE_3D||N===i.TEXTURE_2D_ARRAY?i.texImage3D(St,0,i.RGBA,1,1,Q,0,i.RGBA,i.UNSIGNED_BYTE,vt):i.texImage2D(St+Xt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,vt);return mt}let Tt={};Tt[i.TEXTURE_2D]=ct(i.TEXTURE_2D,i.TEXTURE_2D,1),Tt[i.TEXTURE_CUBE_MAP]=ct(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Tt[i.TEXTURE_2D_ARRAY]=ct(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Tt[i.TEXTURE_3D]=ct(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),lt(i.DEPTH_TEST),a.setFunc(Vi),ot(!1),bt(Il),lt(i.CULL_FACE),w(dn);function lt(N){h[N]!==!0&&(i.enable(N),h[N]=!0)}function Bt(N){h[N]!==!1&&(i.disable(N),h[N]=!1)}function Ht(N,St){return u[N]!==St?(i.bindFramebuffer(N,St),u[N]=St,N===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=St),N===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=St),!0):!1}function Gt(N,St){let q=p,Q=!1;if(N){q=d.get(St),q===void 0&&(q=[],d.set(St,q));let vt=N.textures;if(q.length!==vt.length||q[0]!==i.COLOR_ATTACHMENT0){for(let mt=0,Xt=vt.length;mt<Xt;mt++)q[mt]=i.COLOR_ATTACHMENT0+mt;q.length=vt.length,Q=!0}}else q[0]!==i.BACK&&(q[0]=i.BACK,Q=!0);Q&&i.drawBuffers(q)}function te(N){return g!==N?(i.useProgram(N),g=N,!0):!1}let j={[si]:i.FUNC_ADD,[wh]:i.FUNC_SUBTRACT,[Ah]:i.FUNC_REVERSE_SUBTRACT};j[Rh]=i.MIN,j[Ch]=i.MAX;let ht={[Ih]:i.ZERO,[Ph]:i.ONE,[Lh]:i.SRC_COLOR,[Ba]:i.SRC_ALPHA,[Bh]:i.SRC_ALPHA_SATURATE,[Fh]:i.DST_COLOR,[Uh]:i.DST_ALPHA,[Dh]:i.ONE_MINUS_SRC_COLOR,[za]:i.ONE_MINUS_SRC_ALPHA,[Oh]:i.ONE_MINUS_DST_COLOR,[Nh]:i.ONE_MINUS_DST_ALPHA,[zh]:i.CONSTANT_COLOR,[kh]:i.ONE_MINUS_CONSTANT_COLOR,[Hh]:i.CONSTANT_ALPHA,[Vh]:i.ONE_MINUS_CONSTANT_ALPHA};function w(N,St,q,Q,vt,mt,Xt,ue,Me,ne){if(N===dn){M===!0&&(Bt(i.BLEND),M=!1);return}if(M===!1&&(lt(i.BLEND),M=!0),N!==Th){if(N!==m||ne!==b){if((f!==si||x!==si)&&(i.blendEquation(i.FUNC_ADD),f=si,x=si),ne)switch(N){case Bi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case _r:i.blendFunc(i.ONE,i.ONE);break;case Pl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Ll:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",N);break}else switch(N){case Bi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case _r:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case Pl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Ll:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",N);break}E=null,S=null,O=null,R=null,I.set(0,0,0),A=0,m=N,b=ne}return}vt=vt||St,mt=mt||q,Xt=Xt||Q,(St!==f||vt!==x)&&(i.blendEquationSeparate(j[St],j[vt]),f=St,x=vt),(q!==E||Q!==S||mt!==O||Xt!==R)&&(i.blendFuncSeparate(ht[q],ht[Q],ht[mt],ht[Xt]),E=q,S=Q,O=mt,R=Xt),(ue.equals(I)===!1||Me!==A)&&(i.blendColor(ue.r,ue.g,ue.b,Me),I.copy(ue),A=Me),m=N,b=!1}function Ut(N,St){N.side===Tn?Bt(i.CULL_FACE):lt(i.CULL_FACE);let q=N.side===He;St&&(q=!q),ot(q),N.blending===Bi&&N.transparent===!1?w(dn):w(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),a.setFunc(N.depthFunc),a.setTest(N.depthTest),a.setMask(N.depthWrite),r.setMask(N.colorWrite);let Q=N.stencilWrite;o.setTest(Q),Q&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),kt(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?lt(i.SAMPLE_ALPHA_TO_COVERAGE):Bt(i.SAMPLE_ALPHA_TO_COVERAGE)}function ot(N){y!==N&&(N?i.frontFace(i.CW):i.frontFace(i.CCW),y=N)}function bt(N){N!==bh?(lt(i.CULL_FACE),N!==C&&(N===Il?i.cullFace(i.BACK):N===Eh?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Bt(i.CULL_FACE),C=N}function ut(N){N!==H&&(k&&i.lineWidth(N),H=N)}function kt(N,St,q){N?(lt(i.POLYGON_OFFSET_FILL),(B!==St||z!==q)&&(i.polygonOffset(St,q),B=St,z=q)):Bt(i.POLYGON_OFFSET_FILL)}function wt(N){N?lt(i.SCISSOR_TEST):Bt(i.SCISSOR_TEST)}function T(N){N===void 0&&(N=i.TEXTURE0+W-1),dt!==N&&(i.activeTexture(N),dt=N)}function v(N,St,q){q===void 0&&(dt===null?q=i.TEXTURE0+W-1:q=dt);let Q=ft[q];Q===void 0&&(Q={type:void 0,texture:void 0},ft[q]=Q),(Q.type!==N||Q.texture!==St)&&(dt!==q&&(i.activeTexture(q),dt=q),i.bindTexture(N,St||Tt[N]),Q.type=N,Q.texture=St)}function V(){let N=ft[dt];N!==void 0&&N.type!==void 0&&(i.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function J(){try{i.compressedTexImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function nt(){try{i.compressedTexImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function K(){try{i.texSubImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ct(){try{i.texSubImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function yt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function gt(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function $t(){try{i.texStorage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function st(){try{i.texStorage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function At(){try{i.texImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function zt(){try{i.texImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function qt(N){Zt.equals(N)===!1&&(i.scissor(N.x,N.y,N.z,N.w),Zt.copy(N))}function xt(N){$.equals(N)===!1&&(i.viewport(N.x,N.y,N.z,N.w),$.copy(N))}function ee(N,St){let q=c.get(St);q===void 0&&(q=new WeakMap,c.set(St,q));let Q=q.get(N);Q===void 0&&(Q=i.getUniformBlockIndex(St,N.name),q.set(N,Q))}function Kt(N,St){let Q=c.get(St).get(N);l.get(St)!==Q&&(i.uniformBlockBinding(St,Q,N.__bindingPointIndex),l.set(St,Q))}function ce(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},dt=null,ft={},u={},d=new WeakMap,p=[],g=null,M=!1,m=null,f=null,E=null,S=null,x=null,O=null,R=null,I=new Wt(0,0,0),A=0,b=!1,y=null,C=null,H=null,B=null,z=null,Zt.set(0,0,i.canvas.width,i.canvas.height),$.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:lt,disable:Bt,bindFramebuffer:Ht,drawBuffers:Gt,useProgram:te,setBlending:w,setMaterial:Ut,setFlipSided:ot,setCullFace:bt,setLineWidth:ut,setPolygonOffset:kt,setScissorTest:wt,activeTexture:T,bindTexture:v,unbindTexture:V,compressedTexImage2D:J,compressedTexImage3D:nt,texImage2D:At,texImage3D:zt,updateUBOMapping:ee,uniformBlockBinding:Kt,texStorage2D:$t,texStorage3D:st,texSubImage2D:K,texSubImage3D:Ct,compressedTexSubImage2D:yt,compressedTexSubImage3D:gt,scissor:qt,viewport:xt,reset:ce}}function Cc(i,t,e,n){let s=hg(n);switch(e){case qc:return i*t;case Zc:return i*t;case $c:return i*t*2;case Jc:return i*t/s.components*s.byteLength;case xl:return i*t/s.components*s.byteLength;case Kc:return i*t*2/s.components*s.byteLength;case vl:return i*t*2/s.components*s.byteLength;case Yc:return i*t*3/s.components*s.byteLength;case on:return i*t*4/s.components*s.byteLength;case yl:return i*t*4/s.components*s.byteLength;case dr:case fr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case pr:case mr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ka:case ja:return Math.max(i,16)*Math.max(t,8)/4;case Ja:case Qa:return Math.max(i,8)*Math.max(t,8)/2;case to:case eo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case no:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case io:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case so:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case ro:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case ao:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case oo:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case lo:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case co:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case ho:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case uo:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case fo:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case po:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case mo:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case go:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case _o:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case gr:case xo:case vo:return Math.ceil(i/4)*Math.ceil(t/4)*16;case Qc:case yo:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Mo:case So:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function hg(i){switch(i){case In:case Gc:return{byteLength:1,components:1};case xs:case Wc:case Ue:return{byteLength:2,components:1};case gl:case _l:return{byteLength:2,components:4};case oi:case ml:case qe:return{byteLength:4,components:1};case Xc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function ug(i,t,e,n,s,r,a){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new it,h=new WeakMap,u,d=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(T,v){return p?new OffscreenCanvas(T,v):ys("canvas")}function M(T,v,V){let J=1,nt=wt(T);if((nt.width>V||nt.height>V)&&(J=V/Math.max(nt.width,nt.height)),J<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){let K=Math.floor(J*nt.width),Ct=Math.floor(J*nt.height);u===void 0&&(u=g(K,Ct));let yt=v?g(K,Ct):u;return yt.width=K,yt.height=Ct,yt.getContext("2d").drawImage(T,0,0,K,Ct),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+nt.width+"x"+nt.height+") to ("+K+"x"+Ct+")."),yt}else return"data"in T&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+nt.width+"x"+nt.height+")."),T;return T}function m(T){return T.generateMipmaps}function f(T){i.generateMipmap(T)}function E(T){return T.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?i.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function S(T,v,V,J,nt=!1){if(T!==null){if(i[T]!==void 0)return i[T];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let K=v;if(v===i.RED&&(V===i.FLOAT&&(K=i.R32F),V===i.HALF_FLOAT&&(K=i.R16F),V===i.UNSIGNED_BYTE&&(K=i.R8)),v===i.RED_INTEGER&&(V===i.UNSIGNED_BYTE&&(K=i.R8UI),V===i.UNSIGNED_SHORT&&(K=i.R16UI),V===i.UNSIGNED_INT&&(K=i.R32UI),V===i.BYTE&&(K=i.R8I),V===i.SHORT&&(K=i.R16I),V===i.INT&&(K=i.R32I)),v===i.RG&&(V===i.FLOAT&&(K=i.RG32F),V===i.HALF_FLOAT&&(K=i.RG16F),V===i.UNSIGNED_BYTE&&(K=i.RG8)),v===i.RG_INTEGER&&(V===i.UNSIGNED_BYTE&&(K=i.RG8UI),V===i.UNSIGNED_SHORT&&(K=i.RG16UI),V===i.UNSIGNED_INT&&(K=i.RG32UI),V===i.BYTE&&(K=i.RG8I),V===i.SHORT&&(K=i.RG16I),V===i.INT&&(K=i.RG32I)),v===i.RGB_INTEGER&&(V===i.UNSIGNED_BYTE&&(K=i.RGB8UI),V===i.UNSIGNED_SHORT&&(K=i.RGB16UI),V===i.UNSIGNED_INT&&(K=i.RGB32UI),V===i.BYTE&&(K=i.RGB8I),V===i.SHORT&&(K=i.RGB16I),V===i.INT&&(K=i.RGB32I)),v===i.RGBA_INTEGER&&(V===i.UNSIGNED_BYTE&&(K=i.RGBA8UI),V===i.UNSIGNED_SHORT&&(K=i.RGBA16UI),V===i.UNSIGNED_INT&&(K=i.RGBA32UI),V===i.BYTE&&(K=i.RGBA8I),V===i.SHORT&&(K=i.RGBA16I),V===i.INT&&(K=i.RGBA32I)),v===i.RGB&&V===i.UNSIGNED_INT_5_9_9_9_REV&&(K=i.RGB9_E5),v===i.RGBA){let Ct=nt?Zr:ie.getTransfer(J);V===i.FLOAT&&(K=i.RGBA32F),V===i.HALF_FLOAT&&(K=i.RGBA16F),V===i.UNSIGNED_BYTE&&(K=Ct===le?i.SRGB8_ALPHA8:i.RGBA8),V===i.UNSIGNED_SHORT_4_4_4_4&&(K=i.RGBA4),V===i.UNSIGNED_SHORT_5_5_5_1&&(K=i.RGB5_A1)}return(K===i.R16F||K===i.R32F||K===i.RG16F||K===i.RG32F||K===i.RGBA16F||K===i.RGBA32F)&&t.get("EXT_color_buffer_float"),K}function x(T,v){let V;return T?v===null||v===oi||v===Xi?V=i.DEPTH24_STENCIL8:v===qe?V=i.DEPTH32F_STENCIL8:v===xs&&(V=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===oi||v===Xi?V=i.DEPTH_COMPONENT24:v===qe?V=i.DEPTH_COMPONENT32F:v===xs&&(V=i.DEPTH_COMPONENT16),V}function O(T,v){return m(T)===!0||T.isFramebufferTexture&&T.minFilter!==Ye&&T.minFilter!==Le?Math.log2(Math.max(v.width,v.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?v.mipmaps.length:1}function R(T){let v=T.target;v.removeEventListener("dispose",R),A(v),v.isVideoTexture&&h.delete(v)}function I(T){let v=T.target;v.removeEventListener("dispose",I),y(v)}function A(T){let v=n.get(T);if(v.__webglInit===void 0)return;let V=T.source,J=d.get(V);if(J){let nt=J[v.__cacheKey];nt.usedTimes--,nt.usedTimes===0&&b(T),Object.keys(J).length===0&&d.delete(V)}n.remove(T)}function b(T){let v=n.get(T);i.deleteTexture(v.__webglTexture);let V=T.source,J=d.get(V);delete J[v.__cacheKey],a.memory.textures--}function y(T){let v=n.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),n.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let J=0;J<6;J++){if(Array.isArray(v.__webglFramebuffer[J]))for(let nt=0;nt<v.__webglFramebuffer[J].length;nt++)i.deleteFramebuffer(v.__webglFramebuffer[J][nt]);else i.deleteFramebuffer(v.__webglFramebuffer[J]);v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer[J])}else{if(Array.isArray(v.__webglFramebuffer))for(let J=0;J<v.__webglFramebuffer.length;J++)i.deleteFramebuffer(v.__webglFramebuffer[J]);else i.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&i.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let J=0;J<v.__webglColorRenderbuffer.length;J++)v.__webglColorRenderbuffer[J]&&i.deleteRenderbuffer(v.__webglColorRenderbuffer[J]);v.__webglDepthRenderbuffer&&i.deleteRenderbuffer(v.__webglDepthRenderbuffer)}let V=T.textures;for(let J=0,nt=V.length;J<nt;J++){let K=n.get(V[J]);K.__webglTexture&&(i.deleteTexture(K.__webglTexture),a.memory.textures--),n.remove(V[J])}n.remove(T)}let C=0;function H(){C=0}function B(){let T=C;return T>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+s.maxTextures),C+=1,T}function z(T){let v=[];return v.push(T.wrapS),v.push(T.wrapT),v.push(T.wrapR||0),v.push(T.magFilter),v.push(T.minFilter),v.push(T.anisotropy),v.push(T.internalFormat),v.push(T.format),v.push(T.type),v.push(T.generateMipmaps),v.push(T.premultiplyAlpha),v.push(T.flipY),v.push(T.unpackAlignment),v.push(T.colorSpace),v.join()}function W(T,v){let V=n.get(T);if(T.isVideoTexture&&ut(T),T.isRenderTargetTexture===!1&&T.version>0&&V.__version!==T.version){let J=T.image;if(J===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(J.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{$(V,T,v);return}}e.bindTexture(i.TEXTURE_2D,V.__webglTexture,i.TEXTURE0+v)}function k(T,v){let V=n.get(T);if(T.version>0&&V.__version!==T.version){$(V,T,v);return}e.bindTexture(i.TEXTURE_2D_ARRAY,V.__webglTexture,i.TEXTURE0+v)}function at(T,v){let V=n.get(T);if(T.version>0&&V.__version!==T.version){$(V,T,v);return}e.bindTexture(i.TEXTURE_3D,V.__webglTexture,i.TEXTURE0+v)}function G(T,v){let V=n.get(T);if(T.version>0&&V.__version!==T.version){ct(V,T,v);return}e.bindTexture(i.TEXTURE_CUBE_MAP,V.__webglTexture,i.TEXTURE0+v)}let dt={[_s]:i.REPEAT,[An]:i.CLAMP_TO_EDGE,[$a]:i.MIRRORED_REPEAT},ft={[Ye]:i.NEAREST,[qh]:i.NEAREST_MIPMAP_NEAREST,[Hs]:i.NEAREST_MIPMAP_LINEAR,[Le]:i.LINEAR,[ra]:i.LINEAR_MIPMAP_NEAREST,[Hn]:i.LINEAR_MIPMAP_LINEAR},Rt={[Jh]:i.NEVER,[nu]:i.ALWAYS,[Kh]:i.LESS,[th]:i.LEQUAL,[Qh]:i.EQUAL,[eu]:i.GEQUAL,[jh]:i.GREATER,[tu]:i.NOTEQUAL};function Ft(T,v){if(v.type===qe&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===Le||v.magFilter===ra||v.magFilter===Hs||v.magFilter===Hn||v.minFilter===Le||v.minFilter===ra||v.minFilter===Hs||v.minFilter===Hn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(T,i.TEXTURE_WRAP_S,dt[v.wrapS]),i.texParameteri(T,i.TEXTURE_WRAP_T,dt[v.wrapT]),(T===i.TEXTURE_3D||T===i.TEXTURE_2D_ARRAY)&&i.texParameteri(T,i.TEXTURE_WRAP_R,dt[v.wrapR]),i.texParameteri(T,i.TEXTURE_MAG_FILTER,ft[v.magFilter]),i.texParameteri(T,i.TEXTURE_MIN_FILTER,ft[v.minFilter]),v.compareFunction&&(i.texParameteri(T,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(T,i.TEXTURE_COMPARE_FUNC,Rt[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Ye||v.minFilter!==Hs&&v.minFilter!==Hn||v.type===qe&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){let V=t.get("EXT_texture_filter_anisotropic");i.texParameterf(T,V.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,s.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Zt(T,v){let V=!1;T.__webglInit===void 0&&(T.__webglInit=!0,v.addEventListener("dispose",R));let J=v.source,nt=d.get(J);nt===void 0&&(nt={},d.set(J,nt));let K=z(v);if(K!==T.__cacheKey){nt[K]===void 0&&(nt[K]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,V=!0),nt[K].usedTimes++;let Ct=nt[T.__cacheKey];Ct!==void 0&&(nt[T.__cacheKey].usedTimes--,Ct.usedTimes===0&&b(v)),T.__cacheKey=K,T.__webglTexture=nt[K].texture}return V}function $(T,v,V){let J=i.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(J=i.TEXTURE_2D_ARRAY),v.isData3DTexture&&(J=i.TEXTURE_3D);let nt=Zt(T,v),K=v.source;e.bindTexture(J,T.__webglTexture,i.TEXTURE0+V);let Ct=n.get(K);if(K.version!==Ct.__version||nt===!0){e.activeTexture(i.TEXTURE0+V);let yt=ie.getPrimaries(ie.workingColorSpace),gt=v.colorSpace===kn?null:ie.getPrimaries(v.colorSpace),$t=v.colorSpace===kn||yt===gt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,$t);let st=M(v.image,!1,s.maxTextureSize);st=kt(v,st);let At=r.convert(v.format,v.colorSpace),zt=r.convert(v.type),qt=S(v.internalFormat,At,zt,v.colorSpace,v.isVideoTexture);Ft(J,v);let xt,ee=v.mipmaps,Kt=v.isVideoTexture!==!0,ce=Ct.__version===void 0||nt===!0,N=K.dataReady,St=O(v,st);if(v.isDepthTexture)qt=x(v.format===qi,v.type),ce&&(Kt?e.texStorage2D(i.TEXTURE_2D,1,qt,st.width,st.height):e.texImage2D(i.TEXTURE_2D,0,qt,st.width,st.height,0,At,zt,null));else if(v.isDataTexture)if(ee.length>0){Kt&&ce&&e.texStorage2D(i.TEXTURE_2D,St,qt,ee[0].width,ee[0].height);for(let q=0,Q=ee.length;q<Q;q++)xt=ee[q],Kt?N&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,xt.width,xt.height,At,zt,xt.data):e.texImage2D(i.TEXTURE_2D,q,qt,xt.width,xt.height,0,At,zt,xt.data);v.generateMipmaps=!1}else Kt?(ce&&e.texStorage2D(i.TEXTURE_2D,St,qt,st.width,st.height),N&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,st.width,st.height,At,zt,st.data)):e.texImage2D(i.TEXTURE_2D,0,qt,st.width,st.height,0,At,zt,st.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Kt&&ce&&e.texStorage3D(i.TEXTURE_2D_ARRAY,St,qt,ee[0].width,ee[0].height,st.depth);for(let q=0,Q=ee.length;q<Q;q++)if(xt=ee[q],v.format!==on)if(At!==null)if(Kt){if(N)if(v.layerUpdates.size>0){let vt=Cc(xt.width,xt.height,v.format,v.type);for(let mt of v.layerUpdates){let Xt=xt.data.subarray(mt*vt/xt.data.BYTES_PER_ELEMENT,(mt+1)*vt/xt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,mt,xt.width,xt.height,1,At,Xt)}v.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,0,xt.width,xt.height,st.depth,At,xt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,q,qt,xt.width,xt.height,st.depth,0,xt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Kt?N&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,0,xt.width,xt.height,st.depth,At,zt,xt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,q,qt,xt.width,xt.height,st.depth,0,At,zt,xt.data)}else{Kt&&ce&&e.texStorage2D(i.TEXTURE_2D,St,qt,ee[0].width,ee[0].height);for(let q=0,Q=ee.length;q<Q;q++)xt=ee[q],v.format!==on?At!==null?Kt?N&&e.compressedTexSubImage2D(i.TEXTURE_2D,q,0,0,xt.width,xt.height,At,xt.data):e.compressedTexImage2D(i.TEXTURE_2D,q,qt,xt.width,xt.height,0,xt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Kt?N&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,xt.width,xt.height,At,zt,xt.data):e.texImage2D(i.TEXTURE_2D,q,qt,xt.width,xt.height,0,At,zt,xt.data)}else if(v.isDataArrayTexture)if(Kt){if(ce&&e.texStorage3D(i.TEXTURE_2D_ARRAY,St,qt,st.width,st.height,st.depth),N)if(v.layerUpdates.size>0){let q=Cc(st.width,st.height,v.format,v.type);for(let Q of v.layerUpdates){let vt=st.data.subarray(Q*q/st.data.BYTES_PER_ELEMENT,(Q+1)*q/st.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,Q,st.width,st.height,1,At,zt,vt)}v.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,st.width,st.height,st.depth,At,zt,st.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,qt,st.width,st.height,st.depth,0,At,zt,st.data);else if(v.isData3DTexture)Kt?(ce&&e.texStorage3D(i.TEXTURE_3D,St,qt,st.width,st.height,st.depth),N&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,st.width,st.height,st.depth,At,zt,st.data)):e.texImage3D(i.TEXTURE_3D,0,qt,st.width,st.height,st.depth,0,At,zt,st.data);else if(v.isFramebufferTexture){if(ce)if(Kt)e.texStorage2D(i.TEXTURE_2D,St,qt,st.width,st.height);else{let q=st.width,Q=st.height;for(let vt=0;vt<St;vt++)e.texImage2D(i.TEXTURE_2D,vt,qt,q,Q,0,At,zt,null),q>>=1,Q>>=1}}else if(ee.length>0){if(Kt&&ce){let q=wt(ee[0]);e.texStorage2D(i.TEXTURE_2D,St,qt,q.width,q.height)}for(let q=0,Q=ee.length;q<Q;q++)xt=ee[q],Kt?N&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,At,zt,xt):e.texImage2D(i.TEXTURE_2D,q,qt,At,zt,xt);v.generateMipmaps=!1}else if(Kt){if(ce){let q=wt(st);e.texStorage2D(i.TEXTURE_2D,St,qt,q.width,q.height)}N&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,At,zt,st)}else e.texImage2D(i.TEXTURE_2D,0,qt,At,zt,st);m(v)&&f(J),Ct.__version=K.version,v.onUpdate&&v.onUpdate(v)}T.__version=v.version}function ct(T,v,V){if(v.image.length!==6)return;let J=Zt(T,v),nt=v.source;e.bindTexture(i.TEXTURE_CUBE_MAP,T.__webglTexture,i.TEXTURE0+V);let K=n.get(nt);if(nt.version!==K.__version||J===!0){e.activeTexture(i.TEXTURE0+V);let Ct=ie.getPrimaries(ie.workingColorSpace),yt=v.colorSpace===kn?null:ie.getPrimaries(v.colorSpace),gt=v.colorSpace===kn||Ct===yt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,gt);let $t=v.isCompressedTexture||v.image[0].isCompressedTexture,st=v.image[0]&&v.image[0].isDataTexture,At=[];for(let Q=0;Q<6;Q++)!$t&&!st?At[Q]=M(v.image[Q],!0,s.maxCubemapSize):At[Q]=st?v.image[Q].image:v.image[Q],At[Q]=kt(v,At[Q]);let zt=At[0],qt=r.convert(v.format,v.colorSpace),xt=r.convert(v.type),ee=S(v.internalFormat,qt,xt,v.colorSpace),Kt=v.isVideoTexture!==!0,ce=K.__version===void 0||J===!0,N=nt.dataReady,St=O(v,zt);Ft(i.TEXTURE_CUBE_MAP,v);let q;if($t){Kt&&ce&&e.texStorage2D(i.TEXTURE_CUBE_MAP,St,ee,zt.width,zt.height);for(let Q=0;Q<6;Q++){q=At[Q].mipmaps;for(let vt=0;vt<q.length;vt++){let mt=q[vt];v.format!==on?qt!==null?Kt?N&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,0,0,mt.width,mt.height,qt,mt.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,ee,mt.width,mt.height,0,mt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Kt?N&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,0,0,mt.width,mt.height,qt,xt,mt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt,ee,mt.width,mt.height,0,qt,xt,mt.data)}}}else{if(q=v.mipmaps,Kt&&ce){q.length>0&&St++;let Q=wt(At[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,St,ee,Q.width,Q.height)}for(let Q=0;Q<6;Q++)if(st){Kt?N&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,At[Q].width,At[Q].height,qt,xt,At[Q].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,ee,At[Q].width,At[Q].height,0,qt,xt,At[Q].data);for(let vt=0;vt<q.length;vt++){let Xt=q[vt].image[Q].image;Kt?N&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,0,0,Xt.width,Xt.height,qt,xt,Xt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,ee,Xt.width,Xt.height,0,qt,xt,Xt.data)}}else{Kt?N&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,qt,xt,At[Q]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,ee,qt,xt,At[Q]);for(let vt=0;vt<q.length;vt++){let mt=q[vt];Kt?N&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,0,0,qt,xt,mt.image[Q]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,vt+1,ee,qt,xt,mt.image[Q])}}}m(v)&&f(i.TEXTURE_CUBE_MAP),K.__version=nt.version,v.onUpdate&&v.onUpdate(v)}T.__version=v.version}function Tt(T,v,V,J,nt,K){let Ct=r.convert(V.format,V.colorSpace),yt=r.convert(V.type),gt=S(V.internalFormat,Ct,yt,V.colorSpace),$t=n.get(v),st=n.get(V);if(st.__renderTarget=v,!$t.__hasExternalTextures){let At=Math.max(1,v.width>>K),zt=Math.max(1,v.height>>K);nt===i.TEXTURE_3D||nt===i.TEXTURE_2D_ARRAY?e.texImage3D(nt,K,gt,At,zt,v.depth,0,Ct,yt,null):e.texImage2D(nt,K,gt,At,zt,0,Ct,yt,null)}e.bindFramebuffer(i.FRAMEBUFFER,T),bt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,nt,st.__webglTexture,0,ot(v)):(nt===i.TEXTURE_2D||nt>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&nt<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,J,nt,st.__webglTexture,K),e.bindFramebuffer(i.FRAMEBUFFER,null)}function lt(T,v,V){if(i.bindRenderbuffer(i.RENDERBUFFER,T),v.depthBuffer){let J=v.depthTexture,nt=J&&J.isDepthTexture?J.type:null,K=x(v.stencilBuffer,nt),Ct=v.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,yt=ot(v);bt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,yt,K,v.width,v.height):V?i.renderbufferStorageMultisample(i.RENDERBUFFER,yt,K,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,K,v.width,v.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Ct,i.RENDERBUFFER,T)}else{let J=v.textures;for(let nt=0;nt<J.length;nt++){let K=J[nt],Ct=r.convert(K.format,K.colorSpace),yt=r.convert(K.type),gt=S(K.internalFormat,Ct,yt,K.colorSpace),$t=ot(v);V&&bt(v)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,$t,gt,v.width,v.height):bt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,$t,gt,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,gt,v.width,v.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Bt(T,v){if(v&&v.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,T),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let J=n.get(v.depthTexture);J.__renderTarget=v,(!J.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),W(v.depthTexture,0);let nt=J.__webglTexture,K=ot(v);if(v.depthTexture.format===zi)bt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,nt,0,K):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,nt,0);else if(v.depthTexture.format===qi)bt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,nt,0,K):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,nt,0);else throw new Error("Unknown depthTexture format")}function Ht(T){let v=n.get(T),V=T.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==T.depthTexture){let J=T.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),J){let nt=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,J.removeEventListener("dispose",nt)};J.addEventListener("dispose",nt),v.__depthDisposeCallback=nt}v.__boundDepthTexture=J}if(T.depthTexture&&!v.__autoAllocateDepthBuffer){if(V)throw new Error("target.depthTexture not supported in Cube render targets");Bt(v.__webglFramebuffer,T)}else if(V){v.__webglDepthbuffer=[];for(let J=0;J<6;J++)if(e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[J]),v.__webglDepthbuffer[J]===void 0)v.__webglDepthbuffer[J]=i.createRenderbuffer(),lt(v.__webglDepthbuffer[J],T,!1);else{let nt=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,K=v.__webglDepthbuffer[J];i.bindRenderbuffer(i.RENDERBUFFER,K),i.framebufferRenderbuffer(i.FRAMEBUFFER,nt,i.RENDERBUFFER,K)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=i.createRenderbuffer(),lt(v.__webglDepthbuffer,T,!1);else{let J=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,nt=v.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,nt),i.framebufferRenderbuffer(i.FRAMEBUFFER,J,i.RENDERBUFFER,nt)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function Gt(T,v,V){let J=n.get(T);v!==void 0&&Tt(J.__webglFramebuffer,T,T.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),V!==void 0&&Ht(T)}function te(T){let v=T.texture,V=n.get(T),J=n.get(v);T.addEventListener("dispose",I);let nt=T.textures,K=T.isWebGLCubeRenderTarget===!0,Ct=nt.length>1;if(Ct||(J.__webglTexture===void 0&&(J.__webglTexture=i.createTexture()),J.__version=v.version,a.memory.textures++),K){V.__webglFramebuffer=[];for(let yt=0;yt<6;yt++)if(v.mipmaps&&v.mipmaps.length>0){V.__webglFramebuffer[yt]=[];for(let gt=0;gt<v.mipmaps.length;gt++)V.__webglFramebuffer[yt][gt]=i.createFramebuffer()}else V.__webglFramebuffer[yt]=i.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){V.__webglFramebuffer=[];for(let yt=0;yt<v.mipmaps.length;yt++)V.__webglFramebuffer[yt]=i.createFramebuffer()}else V.__webglFramebuffer=i.createFramebuffer();if(Ct)for(let yt=0,gt=nt.length;yt<gt;yt++){let $t=n.get(nt[yt]);$t.__webglTexture===void 0&&($t.__webglTexture=i.createTexture(),a.memory.textures++)}if(T.samples>0&&bt(T)===!1){V.__webglMultisampledFramebuffer=i.createFramebuffer(),V.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,V.__webglMultisampledFramebuffer);for(let yt=0;yt<nt.length;yt++){let gt=nt[yt];V.__webglColorRenderbuffer[yt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,V.__webglColorRenderbuffer[yt]);let $t=r.convert(gt.format,gt.colorSpace),st=r.convert(gt.type),At=S(gt.internalFormat,$t,st,gt.colorSpace,T.isXRRenderTarget===!0),zt=ot(T);i.renderbufferStorageMultisample(i.RENDERBUFFER,zt,At,T.width,T.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+yt,i.RENDERBUFFER,V.__webglColorRenderbuffer[yt])}i.bindRenderbuffer(i.RENDERBUFFER,null),T.depthBuffer&&(V.__webglDepthRenderbuffer=i.createRenderbuffer(),lt(V.__webglDepthRenderbuffer,T,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(K){e.bindTexture(i.TEXTURE_CUBE_MAP,J.__webglTexture),Ft(i.TEXTURE_CUBE_MAP,v);for(let yt=0;yt<6;yt++)if(v.mipmaps&&v.mipmaps.length>0)for(let gt=0;gt<v.mipmaps.length;gt++)Tt(V.__webglFramebuffer[yt][gt],T,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+yt,gt);else Tt(V.__webglFramebuffer[yt],T,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+yt,0);m(v)&&f(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(Ct){for(let yt=0,gt=nt.length;yt<gt;yt++){let $t=nt[yt],st=n.get($t);e.bindTexture(i.TEXTURE_2D,st.__webglTexture),Ft(i.TEXTURE_2D,$t),Tt(V.__webglFramebuffer,T,$t,i.COLOR_ATTACHMENT0+yt,i.TEXTURE_2D,0),m($t)&&f(i.TEXTURE_2D)}e.unbindTexture()}else{let yt=i.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(yt=T.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(yt,J.__webglTexture),Ft(yt,v),v.mipmaps&&v.mipmaps.length>0)for(let gt=0;gt<v.mipmaps.length;gt++)Tt(V.__webglFramebuffer[gt],T,v,i.COLOR_ATTACHMENT0,yt,gt);else Tt(V.__webglFramebuffer,T,v,i.COLOR_ATTACHMENT0,yt,0);m(v)&&f(yt),e.unbindTexture()}T.depthBuffer&&Ht(T)}function j(T){let v=T.textures;for(let V=0,J=v.length;V<J;V++){let nt=v[V];if(m(nt)){let K=E(T),Ct=n.get(nt).__webglTexture;e.bindTexture(K,Ct),f(K),e.unbindTexture()}}}let ht=[],w=[];function Ut(T){if(T.samples>0){if(bt(T)===!1){let v=T.textures,V=T.width,J=T.height,nt=i.COLOR_BUFFER_BIT,K=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Ct=n.get(T),yt=v.length>1;if(yt)for(let gt=0;gt<v.length;gt++)e.bindFramebuffer(i.FRAMEBUFFER,Ct.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,Ct.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,Ct.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ct.__webglFramebuffer);for(let gt=0;gt<v.length;gt++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(nt|=i.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(nt|=i.STENCIL_BUFFER_BIT)),yt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Ct.__webglColorRenderbuffer[gt]);let $t=n.get(v[gt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,$t,0)}i.blitFramebuffer(0,0,V,J,0,0,V,J,nt,i.NEAREST),l===!0&&(ht.length=0,w.length=0,ht.push(i.COLOR_ATTACHMENT0+gt),T.depthBuffer&&T.resolveDepthBuffer===!1&&(ht.push(K),w.push(K),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,w)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ht))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),yt)for(let gt=0;gt<v.length;gt++){e.bindFramebuffer(i.FRAMEBUFFER,Ct.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.RENDERBUFFER,Ct.__webglColorRenderbuffer[gt]);let $t=n.get(v[gt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,Ct.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.TEXTURE_2D,$t,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ct.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&l){let v=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[v])}}}function ot(T){return Math.min(s.maxSamples,T.samples)}function bt(T){let v=n.get(T);return T.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function ut(T){let v=a.render.frame;h.get(T)!==v&&(h.set(T,v),T.update())}function kt(T,v){let V=T.colorSpace,J=T.format,nt=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||V!==qn&&V!==kn&&(ie.getTransfer(V)===le?(J!==on||nt!==In)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",V)),v}function wt(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(c.width=T.naturalWidth||T.width,c.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(c.width=T.displayWidth,c.height=T.displayHeight):(c.width=T.width,c.height=T.height),c}this.allocateTextureUnit=B,this.resetTextureUnits=H,this.setTexture2D=W,this.setTexture2DArray=k,this.setTexture3D=at,this.setTextureCube=G,this.rebindTextures=Gt,this.setupRenderTarget=te,this.updateRenderTargetMipmap=j,this.updateMultisampleRenderTarget=Ut,this.setupDepthRenderbuffer=Ht,this.setupFrameBufferTexture=Tt,this.useMultisampledRTT=bt}function dg(i,t){function e(n,s=kn){let r,a=ie.getTransfer(s);if(n===In)return i.UNSIGNED_BYTE;if(n===gl)return i.UNSIGNED_SHORT_4_4_4_4;if(n===_l)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Xc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Gc)return i.BYTE;if(n===Wc)return i.SHORT;if(n===xs)return i.UNSIGNED_SHORT;if(n===ml)return i.INT;if(n===oi)return i.UNSIGNED_INT;if(n===qe)return i.FLOAT;if(n===Ue)return i.HALF_FLOAT;if(n===qc)return i.ALPHA;if(n===Yc)return i.RGB;if(n===on)return i.RGBA;if(n===Zc)return i.LUMINANCE;if(n===$c)return i.LUMINANCE_ALPHA;if(n===zi)return i.DEPTH_COMPONENT;if(n===qi)return i.DEPTH_STENCIL;if(n===Jc)return i.RED;if(n===xl)return i.RED_INTEGER;if(n===Kc)return i.RG;if(n===vl)return i.RG_INTEGER;if(n===yl)return i.RGBA_INTEGER;if(n===dr||n===fr||n===pr||n===mr)if(a===le)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===dr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===fr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===pr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===mr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===dr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===fr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===pr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===mr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ja||n===Ka||n===Qa||n===ja)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Ja)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ka)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Qa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===ja)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===to||n===eo||n===no)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===to||n===eo)return a===le?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===no)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===io||n===so||n===ro||n===ao||n===oo||n===lo||n===co||n===ho||n===uo||n===fo||n===po||n===mo||n===go||n===_o)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===io)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===so)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ro)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===ao)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===oo)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===lo)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===co)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===ho)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===uo)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===fo)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===po)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===mo)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===go)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===_o)return a===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===gr||n===xo||n===vo)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===gr)return a===le?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===xo)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===vo)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Qc||n===yo||n===Mo||n===So)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===gr)return r.COMPRESSED_RED_RGTC1_EXT;if(n===yo)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Mo)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===So)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Xi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var Oo=class extends Pe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}},ve=class extends Ve{constructor(){super(),this.isGroup=!0,this.type="Group"}},fg={type:"move"},fs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ve,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ve,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new P,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new P),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ve,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new P,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new P),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(let M of t.hand.values()){let m=e.getJointPose(M,n),f=this._getHandJoint(c,M);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;c.inputState.pinching&&d>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(fg)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new ve;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},pg=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,mg=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Bo=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){let s=new Oe,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new Ee({vertexShader:pg,fragmentShader:mg,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Vt(new $e(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},zo=class extends Wn{constructor(t,e){super();let n=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,g=null,M=new Bo,m=e.getContextAttributes(),f=null,E=null,S=[],x=[],O=new it,R=null,I=new Pe;I.viewport=new he;let A=new Pe;A.viewport=new he;let b=[I,A],y=new Oo,C=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let ct=S[$];return ct===void 0&&(ct=new fs,S[$]=ct),ct.getTargetRaySpace()},this.getControllerGrip=function($){let ct=S[$];return ct===void 0&&(ct=new fs,S[$]=ct),ct.getGripSpace()},this.getHand=function($){let ct=S[$];return ct===void 0&&(ct=new fs,S[$]=ct),ct.getHandSpace()};function B($){let ct=x.indexOf($.inputSource);if(ct===-1)return;let Tt=S[ct];Tt!==void 0&&(Tt.update($.inputSource,$.frame,c||a),Tt.dispatchEvent({type:$.type,data:$.inputSource}))}function z(){s.removeEventListener("select",B),s.removeEventListener("selectstart",B),s.removeEventListener("selectend",B),s.removeEventListener("squeeze",B),s.removeEventListener("squeezestart",B),s.removeEventListener("squeezeend",B),s.removeEventListener("end",z),s.removeEventListener("inputsourceschange",W);for(let $=0;$<S.length;$++){let ct=x[$];ct!==null&&(x[$]=null,S[$].disconnect(ct))}C=null,H=null,M.reset(),t.setRenderTarget(f),p=null,d=null,u=null,s=null,E=null,Zt.stop(),n.isPresenting=!1,t.setPixelRatio(R),t.setSize(O.width,O.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){r=$,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){o=$,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function($){if(s=$,s!==null){if(f=t.getRenderTarget(),s.addEventListener("select",B),s.addEventListener("selectstart",B),s.addEventListener("selectend",B),s.addEventListener("squeeze",B),s.addEventListener("squeezestart",B),s.addEventListener("squeezeend",B),s.addEventListener("end",z),s.addEventListener("inputsourceschange",W),m.xrCompatible!==!0&&await e.makeXRCompatible(),R=t.getPixelRatio(),t.getSize(O),s.renderState.layers===void 0){let ct={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,e,ct),s.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),E=new Be(p.framebufferWidth,p.framebufferHeight,{format:on,type:In,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let ct=null,Tt=null,lt=null;m.depth&&(lt=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,ct=m.stencil?qi:zi,Tt=m.stencil?Xi:oi);let Bt={colorFormat:e.RGBA8,depthFormat:lt,scaleFactor:r};u=new XRWebGLBinding(s,e),d=u.createProjectionLayer(Bt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),E=new Be(d.textureWidth,d.textureHeight,{format:on,type:In,depthTexture:new Ar(d.textureWidth,d.textureHeight,Tt,void 0,void 0,void 0,void 0,void 0,void 0,ct),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Zt.setContext(s),Zt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return M.getDepthTexture()};function W($){for(let ct=0;ct<$.removed.length;ct++){let Tt=$.removed[ct],lt=x.indexOf(Tt);lt>=0&&(x[lt]=null,S[lt].disconnect(Tt))}for(let ct=0;ct<$.added.length;ct++){let Tt=$.added[ct],lt=x.indexOf(Tt);if(lt===-1){for(let Ht=0;Ht<S.length;Ht++)if(Ht>=x.length){x.push(Tt),lt=Ht;break}else if(x[Ht]===null){x[Ht]=Tt,lt=Ht;break}if(lt===-1)break}let Bt=S[lt];Bt&&Bt.connect(Tt)}}let k=new P,at=new P;function G($,ct,Tt){k.setFromMatrixPosition(ct.matrixWorld),at.setFromMatrixPosition(Tt.matrixWorld);let lt=k.distanceTo(at),Bt=ct.projectionMatrix.elements,Ht=Tt.projectionMatrix.elements,Gt=Bt[14]/(Bt[10]-1),te=Bt[14]/(Bt[10]+1),j=(Bt[9]+1)/Bt[5],ht=(Bt[9]-1)/Bt[5],w=(Bt[8]-1)/Bt[0],Ut=(Ht[8]+1)/Ht[0],ot=Gt*w,bt=Gt*Ut,ut=lt/(-w+Ut),kt=ut*-w;if(ct.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(kt),$.translateZ(ut),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),Bt[10]===-1)$.projectionMatrix.copy(ct.projectionMatrix),$.projectionMatrixInverse.copy(ct.projectionMatrixInverse);else{let wt=Gt+ut,T=te+ut,v=ot-kt,V=bt+(lt-kt),J=j*te/T*wt,nt=ht*te/T*wt;$.projectionMatrix.makePerspective(v,V,J,nt,wt,T),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function dt($,ct){ct===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(ct.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(s===null)return;let ct=$.near,Tt=$.far;M.texture!==null&&(M.depthNear>0&&(ct=M.depthNear),M.depthFar>0&&(Tt=M.depthFar)),y.near=A.near=I.near=ct,y.far=A.far=I.far=Tt,(C!==y.near||H!==y.far)&&(s.updateRenderState({depthNear:y.near,depthFar:y.far}),C=y.near,H=y.far),I.layers.mask=$.layers.mask|2,A.layers.mask=$.layers.mask|4,y.layers.mask=I.layers.mask|A.layers.mask;let lt=$.parent,Bt=y.cameras;dt(y,lt);for(let Ht=0;Ht<Bt.length;Ht++)dt(Bt[Ht],lt);Bt.length===2?G(y,I,A):y.projectionMatrix.copy(I.projectionMatrix),ft($,y,lt)};function ft($,ct,Tt){Tt===null?$.matrix.copy(ct.matrixWorld):($.matrix.copy(Tt.matrixWorld),$.matrix.invert(),$.matrix.multiply(ct.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(ct.projectionMatrix),$.projectionMatrixInverse.copy(ct.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=vs*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function($){l=$,d!==null&&(d.fixedFoveation=$),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=$)},this.hasDepthSensing=function(){return M.texture!==null},this.getDepthSensingMesh=function(){return M.getMesh(y)};let Rt=null;function Ft($,ct){if(h=ct.getViewerPose(c||a),g=ct,h!==null){let Tt=h.views;p!==null&&(t.setRenderTargetFramebuffer(E,p.framebuffer),t.setRenderTarget(E));let lt=!1;Tt.length!==y.cameras.length&&(y.cameras.length=0,lt=!0);for(let Ht=0;Ht<Tt.length;Ht++){let Gt=Tt[Ht],te=null;if(p!==null)te=p.getViewport(Gt);else{let ht=u.getViewSubImage(d,Gt);te=ht.viewport,Ht===0&&(t.setRenderTargetTextures(E,ht.colorTexture,d.ignoreDepthValues?void 0:ht.depthStencilTexture),t.setRenderTarget(E))}let j=b[Ht];j===void 0&&(j=new Pe,j.layers.enable(Ht),j.viewport=new he,b[Ht]=j),j.matrix.fromArray(Gt.transform.matrix),j.matrix.decompose(j.position,j.quaternion,j.scale),j.projectionMatrix.fromArray(Gt.projectionMatrix),j.projectionMatrixInverse.copy(j.projectionMatrix).invert(),j.viewport.set(te.x,te.y,te.width,te.height),Ht===0&&(y.matrix.copy(j.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),lt===!0&&y.cameras.push(j)}let Bt=s.enabledFeatures;if(Bt&&Bt.includes("depth-sensing")){let Ht=u.getDepthInformation(Tt[0]);Ht&&Ht.isValid&&Ht.texture&&M.init(t,Ht,s.renderState)}}for(let Tt=0;Tt<S.length;Tt++){let lt=x[Tt],Bt=S[Tt];lt!==null&&Bt!==void 0&&Bt.update(lt,ct,c||a)}Rt&&Rt($,ct),ct.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ct}),g=null}let Zt=new sh;Zt.setAnimationLoop(Ft),this.setAnimationLoop=function($){Rt=$},this.dispose=function(){}}},ni=new fn,gg=new _e;function _g(i,t){function e(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,ih(i)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function s(m,f,E,S,x){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,x)):f.isMeshMatcapMaterial?(r(m,f),g(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),M(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,E,S):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,e(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===He&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,e(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===He&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,e(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,e(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);let E=t.get(f),S=E.envMap,x=E.envMapRotation;S&&(m.envMap.value=S,ni.copy(x),ni.x*=-1,ni.y*=-1,ni.z*=-1,S.isCubeTexture&&S.isRenderTargetTexture===!1&&(ni.y*=-1,ni.z*=-1),m.envMapRotation.value.setFromMatrix4(gg.makeRotationFromEuler(ni)),m.flipEnvMap.value=S.isCubeTexture&&S.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,e(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,E,S){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*E,m.scale.value=S*.5,f.map&&(m.map.value=f.map,e(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,E){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===He&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=E.texture,m.transmissionSamplerSize.value.set(E.width,E.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function M(m,f){let E=t.get(f).light;m.referencePosition.value.setFromMatrixPosition(E.matrixWorld),m.nearDistance.value=E.shadow.camera.near,m.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function xg(i,t,e,n){let s={},r={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(E,S){let x=S.program;n.uniformBlockBinding(E,x)}function c(E,S){let x=s[E.id];x===void 0&&(g(E),x=h(E),s[E.id]=x,E.addEventListener("dispose",m));let O=S.program;n.updateUBOMapping(E,O);let R=t.render.frame;r[E.id]!==R&&(d(E),r[E.id]=R)}function h(E){let S=u();E.__bindingPointIndex=S;let x=i.createBuffer(),O=E.__size,R=E.usage;return i.bindBuffer(i.UNIFORM_BUFFER,x),i.bufferData(i.UNIFORM_BUFFER,O,R),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,S,x),x}function u(){for(let E=0;E<o;E++)if(a.indexOf(E)===-1)return a.push(E),E;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(E){let S=s[E.id],x=E.uniforms,O=E.__cache;i.bindBuffer(i.UNIFORM_BUFFER,S);for(let R=0,I=x.length;R<I;R++){let A=Array.isArray(x[R])?x[R]:[x[R]];for(let b=0,y=A.length;b<y;b++){let C=A[b];if(p(C,R,b,O)===!0){let H=C.__offset,B=Array.isArray(C.value)?C.value:[C.value],z=0;for(let W=0;W<B.length;W++){let k=B[W],at=M(k);typeof k=="number"||typeof k=="boolean"?(C.__data[0]=k,i.bufferSubData(i.UNIFORM_BUFFER,H+z,C.__data)):k.isMatrix3?(C.__data[0]=k.elements[0],C.__data[1]=k.elements[1],C.__data[2]=k.elements[2],C.__data[3]=0,C.__data[4]=k.elements[3],C.__data[5]=k.elements[4],C.__data[6]=k.elements[5],C.__data[7]=0,C.__data[8]=k.elements[6],C.__data[9]=k.elements[7],C.__data[10]=k.elements[8],C.__data[11]=0):(k.toArray(C.__data,z),z+=at.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,H,C.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(E,S,x,O){let R=E.value,I=S+"_"+x;if(O[I]===void 0)return typeof R=="number"||typeof R=="boolean"?O[I]=R:O[I]=R.clone(),!0;{let A=O[I];if(typeof R=="number"||typeof R=="boolean"){if(A!==R)return O[I]=R,!0}else if(A.equals(R)===!1)return A.copy(R),!0}return!1}function g(E){let S=E.uniforms,x=0,O=16;for(let I=0,A=S.length;I<A;I++){let b=Array.isArray(S[I])?S[I]:[S[I]];for(let y=0,C=b.length;y<C;y++){let H=b[y],B=Array.isArray(H.value)?H.value:[H.value];for(let z=0,W=B.length;z<W;z++){let k=B[z],at=M(k),G=x%O,dt=G%at.boundary,ft=G+dt;x+=dt,ft!==0&&O-ft<at.storage&&(x+=O-ft),H.__data=new Float32Array(at.storage/Float32Array.BYTES_PER_ELEMENT),H.__offset=x,x+=at.storage}}}let R=x%O;return R>0&&(x+=O-R),E.__size=x,E.__cache={},this}function M(E){let S={boundary:0,storage:0};return typeof E=="number"||typeof E=="boolean"?(S.boundary=4,S.storage=4):E.isVector2?(S.boundary=8,S.storage=8):E.isVector3||E.isColor?(S.boundary=16,S.storage=12):E.isVector4?(S.boundary=16,S.storage=16):E.isMatrix3?(S.boundary=48,S.storage=48):E.isMatrix4?(S.boundary=64,S.storage=64):E.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",E),S}function m(E){let S=E.target;S.removeEventListener("dispose",m);let x=a.indexOf(S.__bindingPointIndex);a.splice(x,1),i.deleteBuffer(s[S.id]),delete s[S.id],delete r[S.id]}function f(){for(let E in s)i.deleteBuffer(s[E]);a=[],s={},r={}}return{bind:l,update:c,dispose:f}}var Rr=class{constructor(t={}){let{canvas:e=vu(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=a;let g=new Uint32Array(4),M=new Int32Array(4),m=null,f=null,E=[],S=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Ie,this.toneMapping=Vn,this.toneMappingExposure=1;let x=this,O=!1,R=0,I=0,A=null,b=-1,y=null,C=new he,H=new he,B=null,z=new Wt(0),W=0,k=e.width,at=e.height,G=1,dt=null,ft=null,Rt=new he(0,0,k,at),Ft=new he(0,0,k,at),Zt=!1,$=new bs,ct=!1,Tt=!1,lt=new _e,Bt=new _e,Ht=new P,Gt=new he,te={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},j=!1;function ht(){return A===null?G:1}let w=n;function Ut(_,D){return e.getContext(_,D)}try{let _={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${ll}`),e.addEventListener("webglcontextlost",Q,!1),e.addEventListener("webglcontextrestored",vt,!1),e.addEventListener("webglcontextcreationerror",mt,!1),w===null){let D="webgl2";if(w=Ut(D,_),w===null)throw Ut(D)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(_){throw console.error("THREE.WebGLRenderer: "+_.message),_}let ot,bt,ut,kt,wt,T,v,V,J,nt,K,Ct,yt,gt,$t,st,At,zt,qt,xt,ee,Kt,ce,N;function St(){ot=new Up(w),ot.init(),Kt=new dg(w,ot),bt=new Rp(w,ot,t,Kt),ut=new cg(w,ot),bt.reverseDepthBuffer&&d&&ut.buffers.depth.setReversed(!0),kt=new Op(w),wt=new Jm,T=new ug(w,ot,ut,wt,bt,Kt,kt),v=new Ip(x),V=new Dp(x),J=new Gu(w),ce=new wp(w,J),nt=new Np(w,J,kt,ce),K=new zp(w,nt,J,kt),qt=new Bp(w,bt,T),st=new Cp(wt),Ct=new $m(x,v,V,ot,bt,ce,st),yt=new _g(x,wt),gt=new Qm,$t=new sg(ot),zt=new Tp(x,v,V,ut,K,p,l),At=new og(x,K,bt),N=new xg(w,kt,bt,ut),xt=new Ap(w,ot,kt),ee=new Fp(w,ot,kt),kt.programs=Ct.programs,x.capabilities=bt,x.extensions=ot,x.properties=wt,x.renderLists=gt,x.shadowMap=At,x.state=ut,x.info=kt}St();let q=new zo(x,w);this.xr=q,this.getContext=function(){return w},this.getContextAttributes=function(){return w.getContextAttributes()},this.forceContextLoss=function(){let _=ot.get("WEBGL_lose_context");_&&_.loseContext()},this.forceContextRestore=function(){let _=ot.get("WEBGL_lose_context");_&&_.restoreContext()},this.getPixelRatio=function(){return G},this.setPixelRatio=function(_){_!==void 0&&(G=_,this.setSize(k,at,!1))},this.getSize=function(_){return _.set(k,at)},this.setSize=function(_,D,L=!0){if(q.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}k=_,at=D,e.width=Math.floor(_*G),e.height=Math.floor(D*G),L===!0&&(e.style.width=_+"px",e.style.height=D+"px"),this.setViewport(0,0,_,D)},this.getDrawingBufferSize=function(_){return _.set(k*G,at*G).floor()},this.setDrawingBufferSize=function(_,D,L){k=_,at=D,G=L,e.width=Math.floor(_*L),e.height=Math.floor(D*L),this.setViewport(0,0,_,D)},this.getCurrentViewport=function(_){return _.copy(C)},this.getViewport=function(_){return _.copy(Rt)},this.setViewport=function(_,D,L,F){_.isVector4?Rt.set(_.x,_.y,_.z,_.w):Rt.set(_,D,L,F),ut.viewport(C.copy(Rt).multiplyScalar(G).round())},this.getScissor=function(_){return _.copy(Ft)},this.setScissor=function(_,D,L,F){_.isVector4?Ft.set(_.x,_.y,_.z,_.w):Ft.set(_,D,L,F),ut.scissor(H.copy(Ft).multiplyScalar(G).round())},this.getScissorTest=function(){return Zt},this.setScissorTest=function(_){ut.setScissorTest(Zt=_)},this.setOpaqueSort=function(_){dt=_},this.setTransparentSort=function(_){ft=_},this.getClearColor=function(_){return _.copy(zt.getClearColor())},this.setClearColor=function(){zt.setClearColor.apply(zt,arguments)},this.getClearAlpha=function(){return zt.getClearAlpha()},this.setClearAlpha=function(){zt.setClearAlpha.apply(zt,arguments)},this.clear=function(_=!0,D=!0,L=!0){let F=0;if(_){let U=!1;if(A!==null){let et=A.texture.format;U=et===yl||et===vl||et===xl}if(U){let et=A.texture.type,pt=et===In||et===oi||et===xs||et===Xi||et===gl||et===_l,It=zt.getClearColor(),Pt=zt.getClearAlpha(),Yt=It.r,Jt=It.g,Nt=It.b;pt?(g[0]=Yt,g[1]=Jt,g[2]=Nt,g[3]=Pt,w.clearBufferuiv(w.COLOR,0,g)):(M[0]=Yt,M[1]=Jt,M[2]=Nt,M[3]=Pt,w.clearBufferiv(w.COLOR,0,M))}else F|=w.COLOR_BUFFER_BIT}D&&(F|=w.DEPTH_BUFFER_BIT),L&&(F|=w.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),w.clear(F)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",Q,!1),e.removeEventListener("webglcontextrestored",vt,!1),e.removeEventListener("webglcontextcreationerror",mt,!1),gt.dispose(),$t.dispose(),wt.dispose(),v.dispose(),V.dispose(),K.dispose(),ce.dispose(),N.dispose(),Ct.dispose(),q.dispose(),q.removeEventListener("sessionstart",ks),q.removeEventListener("sessionend",vi),cn.stop()};function Q(_){_.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),O=!0}function vt(){console.log("THREE.WebGLRenderer: Context Restored."),O=!1;let _=kt.autoReset,D=At.enabled,L=At.autoUpdate,F=At.needsUpdate,U=At.type;St(),kt.autoReset=_,At.enabled=D,At.autoUpdate=L,At.needsUpdate=F,At.type=U}function mt(_){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",_.statusMessage)}function Xt(_){let D=_.target;D.removeEventListener("dispose",Xt),ue(D)}function ue(_){Me(_),wt.remove(_)}function Me(_){let D=wt.get(_).programs;D!==void 0&&(D.forEach(function(L){Ct.releaseProgram(L)}),_.isShaderMaterial&&Ct.releaseShaderCache(_))}this.renderBufferDirect=function(_,D,L,F,U,et){D===null&&(D=te);let pt=U.isMesh&&U.matrixWorld.determinant()<0,It=tt(_,D,L,F,U);ut.setMaterial(F,pt);let Pt=L.index,Yt=1;if(F.wireframe===!0){if(Pt=nt.getWireframeAttribute(L),Pt===void 0)return;Yt=2}let Jt=L.drawRange,Nt=L.attributes.position,se=Jt.start*Yt,fe=(Jt.start+Jt.count)*Yt;et!==null&&(se=Math.max(se,et.start*Yt),fe=Math.min(fe,(et.start+et.count)*Yt)),Pt!==null?(se=Math.max(se,0),fe=Math.min(fe,Pt.count)):Nt!=null&&(se=Math.max(se,0),fe=Math.min(fe,Nt.count));let pe=fe-se;if(pe<0||pe===1/0)return;ce.setup(U,F,It,L,Pt);let ke,ae=xt;if(Pt!==null&&(ke=J.get(Pt),ae=ee,ae.setIndex(ke)),U.isMesh)F.wireframe===!0?(ut.setLineWidth(F.wireframeLinewidth*ht()),ae.setMode(w.LINES)):ae.setMode(w.TRIANGLES);else if(U.isLine){let Ot=F.linewidth;Ot===void 0&&(Ot=1),ut.setLineWidth(Ot*ht()),U.isLineSegments?ae.setMode(w.LINES):U.isLineLoop?ae.setMode(w.LINE_LOOP):ae.setMode(w.LINE_STRIP)}else U.isPoints?ae.setMode(w.POINTS):U.isSprite&&ae.setMode(w.TRIANGLES);if(U.isBatchedMesh)if(U._multiDrawInstances!==null)ae.renderMultiDrawInstances(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount,U._multiDrawInstances);else if(ot.get("WEBGL_multi_draw"))ae.renderMultiDraw(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount);else{let Ot=U._multiDrawStarts,gn=U._multiDrawCounts,oe=U._multiDrawCount,nn=Pt?J.get(Pt).bytesPerElement:1,yi=wt.get(F).currentProgram.getUniforms();for(let Ge=0;Ge<oe;Ge++)yi.setValue(w,"_gl_DrawID",Ge),ae.render(Ot[Ge]/nn,gn[Ge])}else if(U.isInstancedMesh)ae.renderInstances(se,pe,U.count);else if(L.isInstancedBufferGeometry){let Ot=L._maxInstanceCount!==void 0?L._maxInstanceCount:1/0,gn=Math.min(L.instanceCount,Ot);ae.renderInstances(se,pe,gn)}else ae.render(se,pe)};function ne(_,D,L){_.transparent===!0&&_.side===Tn&&_.forceSinglePass===!1?(_.side=He,_.needsUpdate=!0,rt(_,D,L),_.side=Gn,_.needsUpdate=!0,rt(_,D,L),_.side=Tn):rt(_,D,L)}this.compile=function(_,D,L=null){L===null&&(L=_),f=$t.get(L),f.init(D),S.push(f),L.traverseVisible(function(U){U.isLight&&U.layers.test(D.layers)&&(f.pushLight(U),U.castShadow&&f.pushShadow(U))}),_!==L&&_.traverseVisible(function(U){U.isLight&&U.layers.test(D.layers)&&(f.pushLight(U),U.castShadow&&f.pushShadow(U))}),f.setupLights();let F=new Set;return _.traverse(function(U){if(!(U.isMesh||U.isPoints||U.isLine||U.isSprite))return;let et=U.material;if(et)if(Array.isArray(et))for(let pt=0;pt<et.length;pt++){let It=et[pt];ne(It,L,U),F.add(It)}else ne(et,L,U),F.add(et)}),S.pop(),f=null,F},this.compileAsync=function(_,D,L=null){let F=this.compile(_,D,L);return new Promise(U=>{function et(){if(F.forEach(function(pt){wt.get(pt).currentProgram.isReady()&&F.delete(pt)}),F.size===0){U(_);return}setTimeout(et,10)}ot.get("KHR_parallel_shader_compile")!==null?et():setTimeout(et,10)})};let ze=null;function de(_){ze&&ze(_)}function ks(){cn.stop()}function vi(){cn.start()}let cn=new sh;cn.setAnimationLoop(de),typeof self<"u"&&cn.setContext(self),this.setAnimationLoop=function(_){ze=_,q.setAnimationLoop(_),_===null?cn.stop():cn.start()},q.addEventListener("sessionstart",ks),q.addEventListener("sessionend",vi),this.render=function(_,D){if(D!==void 0&&D.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(O===!0)return;if(_.matrixWorldAutoUpdate===!0&&_.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),q.enabled===!0&&q.isPresenting===!0&&(q.cameraAutoUpdate===!0&&q.updateCamera(D),D=q.getCamera()),_.isScene===!0&&_.onBeforeRender(x,_,D,A),f=$t.get(_,S.length),f.init(D),S.push(f),Bt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),$.setFromProjectionMatrix(Bt),Tt=this.localClippingEnabled,ct=st.init(this.clippingPlanes,Tt),m=gt.get(_,E.length),m.init(),E.push(m),q.enabled===!0&&q.isPresenting===!0){let et=x.xr.getDepthSensingMesh();et!==null&&Jn(et,D,-1/0,x.sortObjects)}Jn(_,D,0,x.sortObjects),m.finish(),x.sortObjects===!0&&m.sort(dt,ft),j=q.enabled===!1||q.isPresenting===!1||q.hasDepthSensing()===!1,j&&zt.addToRenderList(m,_),this.info.render.frame++,ct===!0&&st.beginShadows();let L=f.state.shadowsArray;At.render(L,_,D),ct===!0&&st.endShadows(),this.info.autoReset===!0&&this.info.reset();let F=m.opaque,U=m.transmissive;if(f.setupLights(),D.isArrayCamera){let et=D.cameras;if(U.length>0)for(let pt=0,It=et.length;pt<It;pt++){let Pt=et[pt];X(F,U,_,Pt)}j&&zt.render(_);for(let pt=0,It=et.length;pt<It;pt++){let Pt=et[pt];es(m,_,Pt,Pt.viewport)}}else U.length>0&&X(F,U,_,D),j&&zt.render(_),es(m,_,D);A!==null&&(T.updateMultisampleRenderTarget(A),T.updateRenderTargetMipmap(A)),_.isScene===!0&&_.onAfterRender(x,_,D),ce.resetDefaultState(),b=-1,y=null,S.pop(),S.length>0?(f=S[S.length-1],ct===!0&&st.setGlobalState(x.clippingPlanes,f.state.camera)):f=null,E.pop(),E.length>0?m=E[E.length-1]:m=null};function Jn(_,D,L,F){if(_.visible===!1)return;if(_.layers.test(D.layers)){if(_.isGroup)L=_.renderOrder;else if(_.isLOD)_.autoUpdate===!0&&_.update(D);else if(_.isLight)f.pushLight(_),_.castShadow&&f.pushShadow(_);else if(_.isSprite){if(!_.frustumCulled||$.intersectsSprite(_)){F&&Gt.setFromMatrixPosition(_.matrixWorld).applyMatrix4(Bt);let pt=K.update(_),It=_.material;It.visible&&m.push(_,pt,It,L,Gt.z,null)}}else if((_.isMesh||_.isLine||_.isPoints)&&(!_.frustumCulled||$.intersectsObject(_))){let pt=K.update(_),It=_.material;if(F&&(_.boundingSphere!==void 0?(_.boundingSphere===null&&_.computeBoundingSphere(),Gt.copy(_.boundingSphere.center)):(pt.boundingSphere===null&&pt.computeBoundingSphere(),Gt.copy(pt.boundingSphere.center)),Gt.applyMatrix4(_.matrixWorld).applyMatrix4(Bt)),Array.isArray(It)){let Pt=pt.groups;for(let Yt=0,Jt=Pt.length;Yt<Jt;Yt++){let Nt=Pt[Yt],se=It[Nt.materialIndex];se&&se.visible&&m.push(_,pt,se,L,Gt.z,Nt)}}else It.visible&&m.push(_,pt,It,L,Gt.z,null)}}let et=_.children;for(let pt=0,It=et.length;pt<It;pt++)Jn(et[pt],D,L,F)}function es(_,D,L,F){let U=_.opaque,et=_.transmissive,pt=_.transparent;f.setupLightsView(L),ct===!0&&st.setGlobalState(x.clippingPlanes,L),F&&ut.viewport(C.copy(F)),U.length>0&&Z(U,D,L),et.length>0&&Z(et,D,L),pt.length>0&&Z(pt,D,L),ut.buffers.depth.setTest(!0),ut.buffers.depth.setMask(!0),ut.buffers.color.setMask(!0),ut.setPolygonOffset(!1)}function X(_,D,L,F){if((L.isScene===!0?L.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[F.id]===void 0&&(f.state.transmissionRenderTarget[F.id]=new Be(1,1,{generateMipmaps:!0,type:ot.has("EXT_color_buffer_half_float")||ot.has("EXT_color_buffer_float")?Ue:In,minFilter:Hn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ie.workingColorSpace}));let et=f.state.transmissionRenderTarget[F.id],pt=F.viewport||C;et.setSize(pt.z,pt.w);let It=x.getRenderTarget();x.setRenderTarget(et),x.getClearColor(z),W=x.getClearAlpha(),W<1&&x.setClearColor(16777215,.5),x.clear(),j&&zt.render(L);let Pt=x.toneMapping;x.toneMapping=Vn;let Yt=F.viewport;if(F.viewport!==void 0&&(F.viewport=void 0),f.setupLightsView(F),ct===!0&&st.setGlobalState(x.clippingPlanes,F),Z(_,L,F),T.updateMultisampleRenderTarget(et),T.updateRenderTargetMipmap(et),ot.has("WEBGL_multisampled_render_to_texture")===!1){let Jt=!1;for(let Nt=0,se=D.length;Nt<se;Nt++){let fe=D[Nt],pe=fe.object,ke=fe.geometry,ae=fe.material,Ot=fe.group;if(ae.side===Tn&&pe.layers.test(F.layers)){let gn=ae.side;ae.side=He,ae.needsUpdate=!0,Y(pe,L,F,ke,ae,Ot),ae.side=gn,ae.needsUpdate=!0,Jt=!0}}Jt===!0&&(T.updateMultisampleRenderTarget(et),T.updateRenderTargetMipmap(et))}x.setRenderTarget(It),x.setClearColor(z,W),Yt!==void 0&&(F.viewport=Yt),x.toneMapping=Pt}function Z(_,D,L){let F=D.isScene===!0?D.overrideMaterial:null;for(let U=0,et=_.length;U<et;U++){let pt=_[U],It=pt.object,Pt=pt.geometry,Yt=F===null?pt.material:F,Jt=pt.group;It.layers.test(L.layers)&&Y(It,D,L,Pt,Yt,Jt)}}function Y(_,D,L,F,U,et){_.onBeforeRender(x,D,L,F,U,et),_.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,_.matrixWorld),_.normalMatrix.getNormalMatrix(_.modelViewMatrix),U.onBeforeRender(x,D,L,F,_,et),U.transparent===!0&&U.side===Tn&&U.forceSinglePass===!1?(U.side=He,U.needsUpdate=!0,x.renderBufferDirect(L,D,F,U,_,et),U.side=Gn,U.needsUpdate=!0,x.renderBufferDirect(L,D,F,U,_,et),U.side=Tn):x.renderBufferDirect(L,D,F,U,_,et),_.onAfterRender(x,D,L,F,U,et)}function rt(_,D,L){D.isScene!==!0&&(D=te);let F=wt.get(_),U=f.state.lights,et=f.state.shadowsArray,pt=U.state.version,It=Ct.getParameters(_,U.state,et,D,L),Pt=Ct.getProgramCacheKey(It),Yt=F.programs;F.environment=_.isMeshStandardMaterial?D.environment:null,F.fog=D.fog,F.envMap=(_.isMeshStandardMaterial?V:v).get(_.envMap||F.environment),F.envMapRotation=F.environment!==null&&_.envMap===null?D.environmentRotation:_.envMapRotation,Yt===void 0&&(_.addEventListener("dispose",Xt),Yt=new Map,F.programs=Yt);let Jt=Yt.get(Pt);if(Jt!==void 0){if(F.currentProgram===Jt&&F.lightsStateVersion===pt)return Dt(_,It),Jt}else It.uniforms=Ct.getUniforms(_),_.onBeforeCompile(It,x),Jt=Ct.acquireProgram(It,Pt),Yt.set(Pt,Jt),F.uniforms=It.uniforms;let Nt=F.uniforms;return(!_.isShaderMaterial&&!_.isRawShaderMaterial||_.clipping===!0)&&(Nt.clippingPlanes=st.uniform),Dt(_,It),F.needsLights=Lt(_),F.lightsStateVersion=pt,F.needsLights&&(Nt.ambientLightColor.value=U.state.ambient,Nt.lightProbe.value=U.state.probe,Nt.directionalLights.value=U.state.directional,Nt.directionalLightShadows.value=U.state.directionalShadow,Nt.spotLights.value=U.state.spot,Nt.spotLightShadows.value=U.state.spotShadow,Nt.rectAreaLights.value=U.state.rectArea,Nt.ltc_1.value=U.state.rectAreaLTC1,Nt.ltc_2.value=U.state.rectAreaLTC2,Nt.pointLights.value=U.state.point,Nt.pointLightShadows.value=U.state.pointShadow,Nt.hemisphereLights.value=U.state.hemi,Nt.directionalShadowMap.value=U.state.directionalShadowMap,Nt.directionalShadowMatrix.value=U.state.directionalShadowMatrix,Nt.spotShadowMap.value=U.state.spotShadowMap,Nt.spotLightMatrix.value=U.state.spotLightMatrix,Nt.spotLightMap.value=U.state.spotLightMap,Nt.pointShadowMap.value=U.state.pointShadowMap,Nt.pointShadowMatrix.value=U.state.pointShadowMatrix),F.currentProgram=Jt,F.uniformsList=null,Jt}function Et(_){if(_.uniformsList===null){let D=_.currentProgram.getUniforms();_.uniformsList=Hi.seqWithValue(D.seq,_.uniforms)}return _.uniformsList}function Dt(_,D){let L=wt.get(_);L.outputColorSpace=D.outputColorSpace,L.batching=D.batching,L.batchingColor=D.batchingColor,L.instancing=D.instancing,L.instancingColor=D.instancingColor,L.instancingMorph=D.instancingMorph,L.skinning=D.skinning,L.morphTargets=D.morphTargets,L.morphNormals=D.morphNormals,L.morphColors=D.morphColors,L.morphTargetsCount=D.morphTargetsCount,L.numClippingPlanes=D.numClippingPlanes,L.numIntersection=D.numClipIntersection,L.vertexAlphas=D.vertexAlphas,L.vertexTangents=D.vertexTangents,L.toneMapping=D.toneMapping}function tt(_,D,L,F,U){D.isScene!==!0&&(D=te),T.resetTextureUnits();let et=D.fog,pt=F.isMeshStandardMaterial?D.environment:null,It=A===null?x.outputColorSpace:A.isXRRenderTarget===!0?A.texture.colorSpace:qn,Pt=(F.isMeshStandardMaterial?V:v).get(F.envMap||pt),Yt=F.vertexColors===!0&&!!L.attributes.color&&L.attributes.color.itemSize===4,Jt=!!L.attributes.tangent&&(!!F.normalMap||F.anisotropy>0),Nt=!!L.morphAttributes.position,se=!!L.morphAttributes.normal,fe=!!L.morphAttributes.color,pe=Vn;F.toneMapped&&(A===null||A.isXRRenderTarget===!0)&&(pe=x.toneMapping);let ke=L.morphAttributes.position||L.morphAttributes.normal||L.morphAttributes.color,ae=ke!==void 0?ke.length:0,Ot=wt.get(F),gn=f.state.lights;if(ct===!0&&(Tt===!0||_!==y)){let Ke=_===y&&F.id===b;st.setState(F,_,Ke)}let oe=!1;F.version===Ot.__version?(Ot.needsLights&&Ot.lightsStateVersion!==gn.state.version||Ot.outputColorSpace!==It||U.isBatchedMesh&&Ot.batching===!1||!U.isBatchedMesh&&Ot.batching===!0||U.isBatchedMesh&&Ot.batchingColor===!0&&U.colorTexture===null||U.isBatchedMesh&&Ot.batchingColor===!1&&U.colorTexture!==null||U.isInstancedMesh&&Ot.instancing===!1||!U.isInstancedMesh&&Ot.instancing===!0||U.isSkinnedMesh&&Ot.skinning===!1||!U.isSkinnedMesh&&Ot.skinning===!0||U.isInstancedMesh&&Ot.instancingColor===!0&&U.instanceColor===null||U.isInstancedMesh&&Ot.instancingColor===!1&&U.instanceColor!==null||U.isInstancedMesh&&Ot.instancingMorph===!0&&U.morphTexture===null||U.isInstancedMesh&&Ot.instancingMorph===!1&&U.morphTexture!==null||Ot.envMap!==Pt||F.fog===!0&&Ot.fog!==et||Ot.numClippingPlanes!==void 0&&(Ot.numClippingPlanes!==st.numPlanes||Ot.numIntersection!==st.numIntersection)||Ot.vertexAlphas!==Yt||Ot.vertexTangents!==Jt||Ot.morphTargets!==Nt||Ot.morphNormals!==se||Ot.morphColors!==fe||Ot.toneMapping!==pe||Ot.morphTargetsCount!==ae)&&(oe=!0):(oe=!0,Ot.__version=F.version);let nn=Ot.currentProgram;oe===!0&&(nn=rt(F,D,U));let yi=!1,Ge=!1,ns=!1,me=nn.getUniforms(),hn=Ot.uniforms;if(ut.useProgram(nn.program)&&(yi=!0,Ge=!0,ns=!0),F.id!==b&&(b=F.id,Ge=!0),yi||y!==_){ut.buffers.depth.getReversed()?(lt.copy(_.projectionMatrix),Mu(lt),Su(lt),me.setValue(w,"projectionMatrix",lt)):me.setValue(w,"projectionMatrix",_.projectionMatrix),me.setValue(w,"viewMatrix",_.matrixWorldInverse);let Ln=me.map.cameraPosition;Ln!==void 0&&Ln.setValue(w,Ht.setFromMatrixPosition(_.matrixWorld)),bt.logarithmicDepthBuffer&&me.setValue(w,"logDepthBufFC",2/(Math.log(_.far+1)/Math.LN2)),(F.isMeshPhongMaterial||F.isMeshToonMaterial||F.isMeshLambertMaterial||F.isMeshBasicMaterial||F.isMeshStandardMaterial||F.isShaderMaterial)&&me.setValue(w,"isOrthographic",_.isOrthographicCamera===!0),y!==_&&(y=_,Ge=!0,ns=!0)}if(U.isSkinnedMesh){me.setOptional(w,U,"bindMatrix"),me.setOptional(w,U,"bindMatrixInverse");let Ke=U.skeleton;Ke&&(Ke.boneTexture===null&&Ke.computeBoneTexture(),me.setValue(w,"boneTexture",Ke.boneTexture,T))}U.isBatchedMesh&&(me.setOptional(w,U,"batchingTexture"),me.setValue(w,"batchingTexture",U._matricesTexture,T),me.setOptional(w,U,"batchingIdTexture"),me.setValue(w,"batchingIdTexture",U._indirectTexture,T),me.setOptional(w,U,"batchingColorTexture"),U._colorsTexture!==null&&me.setValue(w,"batchingColorTexture",U._colorsTexture,T));let is=L.morphAttributes;if((is.position!==void 0||is.normal!==void 0||is.color!==void 0)&&qt.update(U,L,nn),(Ge||Ot.receiveShadow!==U.receiveShadow)&&(Ot.receiveShadow=U.receiveShadow,me.setValue(w,"receiveShadow",U.receiveShadow)),F.isMeshGouraudMaterial&&F.envMap!==null&&(hn.envMap.value=Pt,hn.flipEnvMap.value=Pt.isCubeTexture&&Pt.isRenderTargetTexture===!1?-1:1),F.isMeshStandardMaterial&&F.envMap===null&&D.environment!==null&&(hn.envMapIntensity.value=D.environmentIntensity),Ge&&(me.setValue(w,"toneMappingExposure",x.toneMappingExposure),Ot.needsLights&&_t(hn,ns),et&&F.fog===!0&&yt.refreshFogUniforms(hn,et),yt.refreshMaterialUniforms(hn,F,G,at,f.state.transmissionRenderTarget[_.id]),Hi.upload(w,Et(Ot),hn,T)),F.isShaderMaterial&&F.uniformsNeedUpdate===!0&&(Hi.upload(w,Et(Ot),hn,T),F.uniformsNeedUpdate=!1),F.isSpriteMaterial&&me.setValue(w,"center",U.center),me.setValue(w,"modelViewMatrix",U.modelViewMatrix),me.setValue(w,"normalMatrix",U.normalMatrix),me.setValue(w,"modelMatrix",U.matrixWorld),F.isShaderMaterial||F.isRawShaderMaterial){let Ke=F.uniformsGroups;for(let Ln=0,Dn=Ke.length;Ln<Dn;Ln++){let Cl=Ke[Ln];N.update(Cl,nn),N.bind(Cl,nn)}}return nn}function _t(_,D){_.ambientLightColor.needsUpdate=D,_.lightProbe.needsUpdate=D,_.directionalLights.needsUpdate=D,_.directionalLightShadows.needsUpdate=D,_.pointLights.needsUpdate=D,_.pointLightShadows.needsUpdate=D,_.spotLights.needsUpdate=D,_.spotLightShadows.needsUpdate=D,_.rectAreaLights.needsUpdate=D,_.hemisphereLights.needsUpdate=D}function Lt(_){return _.isMeshLambertMaterial||_.isMeshToonMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isShadowMaterial||_.isShaderMaterial&&_.lights===!0}this.getActiveCubeFace=function(){return R},this.getActiveMipmapLevel=function(){return I},this.getRenderTarget=function(){return A},this.setRenderTargetTextures=function(_,D,L){wt.get(_.texture).__webglTexture=D,wt.get(_.depthTexture).__webglTexture=L;let F=wt.get(_);F.__hasExternalTextures=!0,F.__autoAllocateDepthBuffer=L===void 0,F.__autoAllocateDepthBuffer||ot.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),F.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(_,D){let L=wt.get(_);L.__webglFramebuffer=D,L.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(_,D=0,L=0){A=_,R=D,I=L;let F=!0,U=null,et=!1,pt=!1;if(_){let Pt=wt.get(_);if(Pt.__useDefaultFramebuffer!==void 0)ut.bindFramebuffer(w.FRAMEBUFFER,null),F=!1;else if(Pt.__webglFramebuffer===void 0)T.setupRenderTarget(_);else if(Pt.__hasExternalTextures)T.rebindTextures(_,wt.get(_.texture).__webglTexture,wt.get(_.depthTexture).__webglTexture);else if(_.depthBuffer){let Nt=_.depthTexture;if(Pt.__boundDepthTexture!==Nt){if(Nt!==null&&wt.has(Nt)&&(_.width!==Nt.image.width||_.height!==Nt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");T.setupDepthRenderbuffer(_)}}let Yt=_.texture;(Yt.isData3DTexture||Yt.isDataArrayTexture||Yt.isCompressedArrayTexture)&&(pt=!0);let Jt=wt.get(_).__webglFramebuffer;_.isWebGLCubeRenderTarget?(Array.isArray(Jt[D])?U=Jt[D][L]:U=Jt[D],et=!0):_.samples>0&&T.useMultisampledRTT(_)===!1?U=wt.get(_).__webglMultisampledFramebuffer:Array.isArray(Jt)?U=Jt[L]:U=Jt,C.copy(_.viewport),H.copy(_.scissor),B=_.scissorTest}else C.copy(Rt).multiplyScalar(G).floor(),H.copy(Ft).multiplyScalar(G).floor(),B=Zt;if(ut.bindFramebuffer(w.FRAMEBUFFER,U)&&F&&ut.drawBuffers(_,U),ut.viewport(C),ut.scissor(H),ut.setScissorTest(B),et){let Pt=wt.get(_.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_CUBE_MAP_POSITIVE_X+D,Pt.__webglTexture,L)}else if(pt){let Pt=wt.get(_.texture),Yt=D||0;w.framebufferTextureLayer(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,Pt.__webglTexture,L||0,Yt)}b=-1},this.readRenderTargetPixels=function(_,D,L,F,U,et,pt){if(!(_&&_.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let It=wt.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&pt!==void 0&&(It=It[pt]),It){ut.bindFramebuffer(w.FRAMEBUFFER,It);try{let Pt=_.texture,Yt=Pt.format,Jt=Pt.type;if(!bt.textureFormatReadable(Yt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!bt.textureTypeReadable(Jt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=_.width-F&&L>=0&&L<=_.height-U&&w.readPixels(D,L,F,U,Kt.convert(Yt),Kt.convert(Jt),et)}finally{let Pt=A!==null?wt.get(A).__webglFramebuffer:null;ut.bindFramebuffer(w.FRAMEBUFFER,Pt)}}},this.readRenderTargetPixelsAsync=async function(_,D,L,F,U,et,pt){if(!(_&&_.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let It=wt.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&pt!==void 0&&(It=It[pt]),It){let Pt=_.texture,Yt=Pt.format,Jt=Pt.type;if(!bt.textureFormatReadable(Yt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!bt.textureTypeReadable(Jt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(D>=0&&D<=_.width-F&&L>=0&&L<=_.height-U){ut.bindFramebuffer(w.FRAMEBUFFER,It);let Nt=w.createBuffer();w.bindBuffer(w.PIXEL_PACK_BUFFER,Nt),w.bufferData(w.PIXEL_PACK_BUFFER,et.byteLength,w.STREAM_READ),w.readPixels(D,L,F,U,Kt.convert(Yt),Kt.convert(Jt),0);let se=A!==null?wt.get(A).__webglFramebuffer:null;ut.bindFramebuffer(w.FRAMEBUFFER,se);let fe=w.fenceSync(w.SYNC_GPU_COMMANDS_COMPLETE,0);return w.flush(),await yu(w,fe,4),w.bindBuffer(w.PIXEL_PACK_BUFFER,Nt),w.getBufferSubData(w.PIXEL_PACK_BUFFER,0,et),w.deleteBuffer(Nt),w.deleteSync(fe),et}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(_,D=null,L=0){_.isTexture!==!0&&(cs("WebGLRenderer: copyFramebufferToTexture function signature has changed."),D=arguments[0]||null,_=arguments[1]);let F=Math.pow(2,-L),U=Math.floor(_.image.width*F),et=Math.floor(_.image.height*F),pt=D!==null?D.x:0,It=D!==null?D.y:0;T.setTexture2D(_,0),w.copyTexSubImage2D(w.TEXTURE_2D,L,0,0,pt,It,U,et),ut.unbindTexture()},this.copyTextureToTexture=function(_,D,L=null,F=null,U=0){_.isTexture!==!0&&(cs("WebGLRenderer: copyTextureToTexture function signature has changed."),F=arguments[0]||null,_=arguments[1],D=arguments[2],U=arguments[3]||0,L=null);let et,pt,It,Pt,Yt,Jt,Nt,se,fe,pe=_.isCompressedTexture?_.mipmaps[U]:_.image;L!==null?(et=L.max.x-L.min.x,pt=L.max.y-L.min.y,It=L.isBox3?L.max.z-L.min.z:1,Pt=L.min.x,Yt=L.min.y,Jt=L.isBox3?L.min.z:0):(et=pe.width,pt=pe.height,It=pe.depth||1,Pt=0,Yt=0,Jt=0),F!==null?(Nt=F.x,se=F.y,fe=F.z):(Nt=0,se=0,fe=0);let ke=Kt.convert(D.format),ae=Kt.convert(D.type),Ot;D.isData3DTexture?(T.setTexture3D(D,0),Ot=w.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(T.setTexture2DArray(D,0),Ot=w.TEXTURE_2D_ARRAY):(T.setTexture2D(D,0),Ot=w.TEXTURE_2D),w.pixelStorei(w.UNPACK_FLIP_Y_WEBGL,D.flipY),w.pixelStorei(w.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),w.pixelStorei(w.UNPACK_ALIGNMENT,D.unpackAlignment);let gn=w.getParameter(w.UNPACK_ROW_LENGTH),oe=w.getParameter(w.UNPACK_IMAGE_HEIGHT),nn=w.getParameter(w.UNPACK_SKIP_PIXELS),yi=w.getParameter(w.UNPACK_SKIP_ROWS),Ge=w.getParameter(w.UNPACK_SKIP_IMAGES);w.pixelStorei(w.UNPACK_ROW_LENGTH,pe.width),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,pe.height),w.pixelStorei(w.UNPACK_SKIP_PIXELS,Pt),w.pixelStorei(w.UNPACK_SKIP_ROWS,Yt),w.pixelStorei(w.UNPACK_SKIP_IMAGES,Jt);let ns=_.isDataArrayTexture||_.isData3DTexture,me=D.isDataArrayTexture||D.isData3DTexture;if(_.isRenderTargetTexture||_.isDepthTexture){let hn=wt.get(_),is=wt.get(D),Ke=wt.get(hn.__renderTarget),Ln=wt.get(is.__renderTarget);ut.bindFramebuffer(w.READ_FRAMEBUFFER,Ke.__webglFramebuffer),ut.bindFramebuffer(w.DRAW_FRAMEBUFFER,Ln.__webglFramebuffer);for(let Dn=0;Dn<It;Dn++)ns&&w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,wt.get(_).__webglTexture,U,Jt+Dn),_.isDepthTexture?(me&&w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,wt.get(D).__webglTexture,U,fe+Dn),w.blitFramebuffer(Pt,Yt,et,pt,Nt,se,et,pt,w.DEPTH_BUFFER_BIT,w.NEAREST)):me?w.copyTexSubImage3D(Ot,U,Nt,se,fe+Dn,Pt,Yt,et,pt):w.copyTexSubImage2D(Ot,U,Nt,se,fe+Dn,Pt,Yt,et,pt);ut.bindFramebuffer(w.READ_FRAMEBUFFER,null),ut.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else me?_.isDataTexture||_.isData3DTexture?w.texSubImage3D(Ot,U,Nt,se,fe,et,pt,It,ke,ae,pe.data):D.isCompressedArrayTexture?w.compressedTexSubImage3D(Ot,U,Nt,se,fe,et,pt,It,ke,pe.data):w.texSubImage3D(Ot,U,Nt,se,fe,et,pt,It,ke,ae,pe):_.isDataTexture?w.texSubImage2D(w.TEXTURE_2D,U,Nt,se,et,pt,ke,ae,pe.data):_.isCompressedTexture?w.compressedTexSubImage2D(w.TEXTURE_2D,U,Nt,se,pe.width,pe.height,ke,pe.data):w.texSubImage2D(w.TEXTURE_2D,U,Nt,se,et,pt,ke,ae,pe);w.pixelStorei(w.UNPACK_ROW_LENGTH,gn),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,oe),w.pixelStorei(w.UNPACK_SKIP_PIXELS,nn),w.pixelStorei(w.UNPACK_SKIP_ROWS,yi),w.pixelStorei(w.UNPACK_SKIP_IMAGES,Ge),U===0&&D.generateMipmaps&&w.generateMipmap(Ot),ut.unbindTexture()},this.copyTextureToTexture3D=function(_,D,L=null,F=null,U=0){return _.isTexture!==!0&&(cs("WebGLRenderer: copyTextureToTexture3D function signature has changed."),L=arguments[0]||null,F=arguments[1]||null,_=arguments[2],D=arguments[3],U=arguments[4]||0),cs('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(_,D,L,F,U)},this.initRenderTarget=function(_){wt.get(_).__webglFramebuffer===void 0&&T.setupRenderTarget(_)},this.initTexture=function(_){_.isCubeTexture?T.setTextureCube(_,0):_.isData3DTexture?T.setTexture3D(_,0):_.isDataArrayTexture||_.isCompressedArrayTexture?T.setTexture2DArray(_,0):T.setTexture2D(_,0),ut.unbindTexture()},this.resetState=function(){R=0,I=0,A=null,ut.reset(),ce.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorspace=ie._getDrawingBufferColorSpace(t),e.unpackColorSpace=ie._getUnpackColorSpace()}};var Cr=class extends Ve{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new fn,this.environmentIntensity=1,this.environmentRotation=new fn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}};var ko=class extends Oe{constructor(t=null,e=1,n=1,s,r,a,o,l,c=Ye,h=Ye,u,d){super(null,a,o,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ir=class extends Oe{constructor(t,e,n,s,r,a,o,l,c){super(t,e,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},tn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){let n=this.getLengths(),s=0,r=n.length,a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);let h=n[s],d=n[s+1]-h,p=(a-h)/d;return(s+p)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),l=e||(a.isVector2?new it:new P);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){let n=new P,s=[],r=[],a=[],o=new P,l=new _e;for(let p=0;p<=t;p++){let g=p/t;s[p]=this.getTangentAt(g,new P)}r[0]=new P,a[0]=new P;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let p=1;p<=t;p++){if(r[p]=r[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(s[p-1],s[p]),o.length()>Number.EPSILON){o.normalize();let g=Math.acos(be(s[p-1].dot(s[p]),-1,1));r[p].applyMatrix4(l.makeRotationAxis(o,g))}a[p].crossVectors(s[p],r[p])}if(e===!0){let p=Math.acos(be(r[0].dot(r[t]),-1,1));p/=t,s[0].dot(o.crossVectors(r[0],r[t]))>0&&(p=-p);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],p*g)),a[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Es=class extends tn{constructor(t=0,e=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new it){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);let o=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,p=c-this.aY;l=d*h-p*u+this.aX,c=d*u+p*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Ho=class extends Es{constructor(t,e,n,s,r,a){super(t,e,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}};function El(){let i=0,t=0,e=0,n=0;function s(r,a,o,l){i=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,p=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,p*=h,s(a,o,d,p)},calc:function(r){let a=r*r,o=a*r;return i+t*r+e*a+n*o}}}var lr=new P,Da=new El,Ua=new El,Na=new El,Ts=class extends tn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new P){let n=e,s=this.points,r=s.length,a=(r-(this.closed?0:1))*t,o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(lr.subVectors(s[0],s[1]).add(s[0]),c=lr);let u=s[o%r],d=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(lr.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=lr),this.curveType==="centripetal"||this.curveType==="chordal"){let p=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(u),p),M=Math.pow(u.distanceToSquared(d),p),m=Math.pow(d.distanceToSquared(h),p);M<1e-4&&(M=1),g<1e-4&&(g=M),m<1e-4&&(m=M),Da.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,M,m),Ua.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,M,m),Na.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,M,m)}else this.curveType==="catmullrom"&&(Da.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),Ua.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),Na.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(Da.calc(l),Ua.calc(l),Na.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new P().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function Ic(i,t,e,n,s){let r=(n-t)*.5,a=(s-e)*.5,o=i*i,l=i*o;return(2*e-2*n+r+a)*l+(-3*e+3*n-2*r-a)*o+r*i+e}function vg(i,t){let e=1-i;return e*e*t}function yg(i,t){return 2*(1-i)*i*t}function Mg(i,t){return i*i*t}function ps(i,t,e,n){return vg(i,t)+yg(i,e)+Mg(i,n)}function Sg(i,t){let e=1-i;return e*e*e*t}function bg(i,t){let e=1-i;return 3*e*e*i*t}function Eg(i,t){return 3*(1-i)*i*i*t}function Tg(i,t){return i*i*i*t}function ms(i,t,e,n,s){return Sg(i,t)+bg(i,e)+Eg(i,n)+Tg(i,s)}var Pr=class extends tn{constructor(t=new it,e=new it,n=new it,s=new it){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new it){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ms(t,s.x,r.x,a.x,o.x),ms(t,s.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Vo=class extends tn{constructor(t=new P,e=new P,n=new P,s=new P){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new P){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ms(t,s.x,r.x,a.x,o.x),ms(t,s.y,r.y,a.y,o.y),ms(t,s.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Lr=class extends tn{constructor(t=new it,e=new it){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new it){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new it){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Go=class extends tn{constructor(t=new P,e=new P){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new P){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new P){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Dr=class extends tn{constructor(t=new it,e=new it,n=new it){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new it){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(ps(t,s.x,r.x,a.x),ps(t,s.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Ur=class extends tn{constructor(t=new P,e=new P,n=new P){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new P){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(ps(t,s.x,r.x,a.x),ps(t,s.y,r.y,a.y),ps(t,s.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Nr=class extends tn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new it){let n=e,s=this.points,r=(s.length-1)*t,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],u=s[a>s.length-3?s.length-1:a+2];return n.set(Ic(o,l.x,c.x,h.x,u.x),Ic(o,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new it().fromArray(s))}return this}},Fr=Object.freeze({__proto__:null,ArcCurve:Ho,CatmullRomCurve3:Ts,CubicBezierCurve:Pr,CubicBezierCurve3:Vo,EllipseCurve:Es,LineCurve:Lr,LineCurve3:Go,QuadraticBezierCurve:Dr,QuadraticBezierCurve3:Ur,SplineCurve:Nr}),Wo=class extends tn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Fr[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let a=r[s],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new Fr[s.type]().fromJSON(s))}return this}},Ji=class extends Wo{constructor(t){super(),this.type="Path",this.currentPoint=new it,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new Lr(this.currentPoint.clone(),new it(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new Dr(this.currentPoint.clone(),new it(t,e),new it(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,a){let o=new Pr(this.currentPoint.clone(),new it(t,e),new it(n,s),new it(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new Nr(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,a){let o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,s,r,a),this}absarc(t,e,n,s,r,a){return this.absellipse(t,e,n,n,s,r,a),this}ellipse(t,e,n,s,r,a,o,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,a,o,l),this}absellipse(t,e,n,s,r,a,o,l){let c=new Es(t,e,n,s,r,a,o,l);if(this.curves.length>0){let u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},ws=class i extends De{constructor(t=[new it(0,-.5),new it(.5,0),new it(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=be(s,0,Math.PI*2);let r=[],a=[],o=[],l=[],c=[],h=1/e,u=new P,d=new it,p=new P,g=new P,M=new P,m=0,f=0;for(let E=0;E<=t.length-1;E++)switch(E){case 0:m=t[E+1].x-t[E].x,f=t[E+1].y-t[E].y,p.x=f*1,p.y=-m,p.z=f*0,M.copy(p),p.normalize(),l.push(p.x,p.y,p.z);break;case t.length-1:l.push(M.x,M.y,M.z);break;default:m=t[E+1].x-t[E].x,f=t[E+1].y-t[E].y,p.x=f*1,p.y=-m,p.z=f*0,g.copy(p),p.x+=M.x,p.y+=M.y,p.z+=M.z,p.normalize(),l.push(p.x,p.y,p.z),M.copy(g)}for(let E=0;E<=e;E++){let S=n+E*h*s,x=Math.sin(S),O=Math.cos(S);for(let R=0;R<=t.length-1;R++){u.x=t[R].x*x,u.y=t[R].y,u.z=t[R].x*O,a.push(u.x,u.y,u.z),d.x=E/e,d.y=R/(t.length-1),o.push(d.x,d.y);let I=l[3*R+0]*x,A=l[3*R+1],b=l[3*R+0]*O;c.push(I,A,b)}}for(let E=0;E<e;E++)for(let S=0;S<t.length-1;S++){let x=S+E*t.length,O=x,R=x+t.length,I=x+t.length+1,A=x+1;r.push(O,R,A),r.push(I,A,R)}this.setIndex(r),this.setAttribute("position",new re(a,3)),this.setAttribute("uv",new re(o,2)),this.setAttribute("normal",new re(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.points,t.segments,t.phiStart,t.phiLength)}};var hi=class i extends De{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);let r=[],a=[],o=[],l=[],c=new P,h=new it;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=e;u++,d+=3){let p=n+u/e*s;c.x=t*Math.cos(p),c.y=t*Math.sin(p),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/t+1)/2,h.y=(a[d+1]/t+1)/2,l.push(h.x,h.y)}for(let u=1;u<=e;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new re(a,3)),this.setAttribute("normal",new re(o,3)),this.setAttribute("uv",new re(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.segments,t.thetaStart,t.thetaLength)}},mn=class i extends De{constructor(t=1,e=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],u=[],d=[],p=[],g=0,M=[],m=n/2,f=0;E(),a===!1&&(t>0&&S(!0),e>0&&S(!1)),this.setIndex(h),this.setAttribute("position",new re(u,3)),this.setAttribute("normal",new re(d,3)),this.setAttribute("uv",new re(p,2));function E(){let x=new P,O=new P,R=0,I=(e-t)/n;for(let A=0;A<=r;A++){let b=[],y=A/r,C=y*(e-t)+t;for(let H=0;H<=s;H++){let B=H/s,z=B*l+o,W=Math.sin(z),k=Math.cos(z);O.x=C*W,O.y=-y*n+m,O.z=C*k,u.push(O.x,O.y,O.z),x.set(W,I,k).normalize(),d.push(x.x,x.y,x.z),p.push(B,1-y),b.push(g++)}M.push(b)}for(let A=0;A<s;A++)for(let b=0;b<r;b++){let y=M[b][A],C=M[b+1][A],H=M[b+1][A+1],B=M[b][A+1];(t>0||b!==0)&&(h.push(y,C,B),R+=3),(e>0||b!==r-1)&&(h.push(C,H,B),R+=3)}c.addGroup(f,R,0),f+=R}function S(x){let O=g,R=new it,I=new P,A=0,b=x===!0?t:e,y=x===!0?1:-1;for(let H=1;H<=s;H++)u.push(0,m*y,0),d.push(0,y,0),p.push(.5,.5),g++;let C=g;for(let H=0;H<=s;H++){let z=H/s*l+o,W=Math.cos(z),k=Math.sin(z);I.x=b*k,I.y=m*y,I.z=b*W,u.push(I.x,I.y,I.z),d.push(0,y,0),R.x=W*.5+.5,R.y=k*.5*y+.5,p.push(R.x,R.y),g++}for(let H=0;H<s;H++){let B=O+H,z=C+H;x===!0?h.push(z,z+1,B):h.push(z+1,z,B),A+=3}c.addGroup(f,A,x===!0?1:2),f+=A}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var As=class extends Ji{constructor(t){super(t),this.uuid=gi(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new Ji().fromJSON(s))}return this}},wg={triangulate:function(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=ch(i,0,s,e,!0),a=[];if(!r||r.next===r.prev)return a;let o,l,c,h,u,d,p;if(n&&(r=Pg(i,t,r,e)),i.length>80*e){o=c=i[0],l=h=i[1];for(let g=e;g<s;g+=e)u=i[g],d=i[g+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);p=Math.max(c-o,h-l),p=p!==0?32767/p:0}return Rs(r,a,e,o,l,p,0),a}};function ch(i,t,e,n,s){let r,a;if(s===Vg(i,t,e,n)>0)for(r=t;r<e;r+=n)a=Pc(r,i[r],i[r+1],a);else for(r=e-n;r>=t;r-=n)a=Pc(r,i[r],i[r+1],a);return a&&Jr(a,a.next)&&(Is(a),a=a.next),a}function ui(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Jr(e,e.next)||xe(e.prev,e,e.next)===0)){if(Is(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Rs(i,t,e,n,s,r,a){if(!i)return;!a&&r&&Fg(i,n,s,r);let o=i,l,c;for(;i.prev!==i.next;){if(l=i.prev,c=i.next,r?Rg(i,n,s,r):Ag(i)){t.push(l.i/e|0),t.push(i.i/e|0),t.push(c.i/e|0),Is(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=Cg(ui(i),t,e),Rs(i,t,e,n,s,r,2)):a===2&&Ig(i,t,e,n,s,r):Rs(ui(i),t,e,n,s,r,1);break}}}function Ag(i){let t=i.prev,e=i,n=i.next;if(xe(t,e,n)>=0)return!1;let s=t.x,r=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=s<r?s<a?s:a:r<a?r:a,u=o<l?o<c?o:c:l<c?l:c,d=s>r?s>a?s:a:r>a?r:a,p=o>l?o>c?o:c:l>c?l:c,g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=p&&Oi(s,o,r,l,a,c,g.x,g.y)&&xe(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Rg(i,t,e,n){let s=i.prev,r=i,a=i.next;if(xe(s,r,a)>=0)return!1;let o=s.x,l=r.x,c=a.x,h=s.y,u=r.y,d=a.y,p=o<l?o<c?o:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,M=o>l?o>c?o:c:l>c?l:c,m=h>u?h>d?h:d:u>d?u:d,f=Xo(p,g,t,e,n),E=Xo(M,m,t,e,n),S=i.prevZ,x=i.nextZ;for(;S&&S.z>=f&&x&&x.z<=E;){if(S.x>=p&&S.x<=M&&S.y>=g&&S.y<=m&&S!==s&&S!==a&&Oi(o,h,l,u,c,d,S.x,S.y)&&xe(S.prev,S,S.next)>=0||(S=S.prevZ,x.x>=p&&x.x<=M&&x.y>=g&&x.y<=m&&x!==s&&x!==a&&Oi(o,h,l,u,c,d,x.x,x.y)&&xe(x.prev,x,x.next)>=0))return!1;x=x.nextZ}for(;S&&S.z>=f;){if(S.x>=p&&S.x<=M&&S.y>=g&&S.y<=m&&S!==s&&S!==a&&Oi(o,h,l,u,c,d,S.x,S.y)&&xe(S.prev,S,S.next)>=0)return!1;S=S.prevZ}for(;x&&x.z<=E;){if(x.x>=p&&x.x<=M&&x.y>=g&&x.y<=m&&x!==s&&x!==a&&Oi(o,h,l,u,c,d,x.x,x.y)&&xe(x.prev,x,x.next)>=0)return!1;x=x.nextZ}return!0}function Cg(i,t,e){let n=i;do{let s=n.prev,r=n.next.next;!Jr(s,r)&&hh(s,n,n.next,r)&&Cs(s,r)&&Cs(r,s)&&(t.push(s.i/e|0),t.push(n.i/e|0),t.push(r.i/e|0),Is(n),Is(n.next),n=i=r),n=n.next}while(n!==i);return ui(n)}function Ig(i,t,e,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&zg(a,o)){let l=uh(a,o);a=ui(a,a.next),l=ui(l,l.next),Rs(a,t,e,n,s,r,0),Rs(l,t,e,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function Pg(i,t,e,n){let s=[],r,a,o,l,c;for(r=0,a=t.length;r<a;r++)o=t[r]*n,l=r<a-1?t[r+1]*n:i.length,c=ch(i,o,l,n,!1),c===c.next&&(c.steiner=!0),s.push(Bg(c));for(s.sort(Lg),r=0;r<s.length;r++)e=Dg(s[r],e);return e}function Lg(i,t){return i.x-t.x}function Dg(i,t){let e=Ug(i,t);if(!e)return t;let n=uh(e,i);return ui(n,n.next),ui(e,e.next)}function Ug(i,t){let e=t,n=-1/0,s,r=i.x,a=i.y;do{if(a<=e.y&&a>=e.next.y&&e.next.y!==e.y){let d=e.x+(a-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>n&&(n=d,s=e.x<e.next.x?e:e.next,d===r))return s}e=e.next}while(e!==t);if(!s)return null;let o=s,l=s.x,c=s.y,h=1/0,u;e=s;do r>=e.x&&e.x>=l&&r!==e.x&&Oi(a<c?r:n,a,l,c,a<c?n:r,a,e.x,e.y)&&(u=Math.abs(a-e.y)/(r-e.x),Cs(e,i)&&(u<h||u===h&&(e.x>s.x||e.x===s.x&&Ng(s,e)))&&(s=e,h=u)),e=e.next;while(e!==o);return s}function Ng(i,t){return xe(i.prev,i,t.prev)<0&&xe(t.next,i,i.next)<0}function Fg(i,t,e,n){let s=i;do s.z===0&&(s.z=Xo(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,Og(s)}function Og(i){let t,e,n,s,r,a,o,l,c=1;do{for(e=i,i=null,r=null,a=0;e;){for(a++,n=e,o=0,t=0;t<c&&(o++,n=n.nextZ,!!n);t++);for(l=c;o>0||l>0&&n;)o!==0&&(l===0||!n||e.z<=n.z)?(s=e,e=e.nextZ,o--):(s=n,n=n.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;e=n}r.nextZ=null,c*=2}while(a>1);return i}function Xo(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function Bg(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Oi(i,t,e,n,s,r,a,o){return(s-a)*(t-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(s-a)*(n-o)}function zg(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!kg(i,t)&&(Cs(i,t)&&Cs(t,i)&&Hg(i,t)&&(xe(i.prev,i,t.prev)||xe(i,t.prev,t))||Jr(i,t)&&xe(i.prev,i,i.next)>0&&xe(t.prev,t,t.next)>0)}function xe(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Jr(i,t){return i.x===t.x&&i.y===t.y}function hh(i,t,e,n){let s=hr(xe(i,t,e)),r=hr(xe(i,t,n)),a=hr(xe(e,n,i)),o=hr(xe(e,n,t));return!!(s!==r&&a!==o||s===0&&cr(i,e,t)||r===0&&cr(i,n,t)||a===0&&cr(e,i,n)||o===0&&cr(e,t,n))}function cr(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function hr(i){return i>0?1:i<0?-1:0}function kg(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&hh(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Cs(i,t){return xe(i.prev,i,i.next)<0?xe(i,t,i.next)>=0&&xe(i,i.prev,t)>=0:xe(i,t,i.prev)<0||xe(i,i.next,t)<0}function Hg(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function uh(i,t){let e=new qo(i.i,i.x,i.y),n=new qo(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function Pc(i,t,e,n){let s=new qo(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Is(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function qo(i,t,e){this.i=i,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Vg(i,t,e,n){let s=0;for(let r=t,a=e-n;r<e;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}var gs=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];Lc(t),Dc(n,t);let a=t.length;e.forEach(Lc);for(let l=0;l<e.length;l++)s.push(a),a+=e[l].length,Dc(n,e[l]);let o=wg.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}};function Lc(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function Dc(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var Ps=class i extends De{constructor(t=new As([new it(.5,.5),new it(-.5,.5),new it(-.5,-.5),new it(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let o=0,l=t.length;o<l;o++){let c=t[o];a(c)}this.setAttribute("position",new re(s,3)),this.setAttribute("uv",new re(r,2)),this.computeVertexNormals();function a(o){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1,d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,p=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:p-.1,M=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3,f=e.extrudePath,E=e.UVGenerator!==void 0?e.UVGenerator:Gg,S,x=!1,O,R,I,A;f&&(S=f.getSpacedPoints(h),x=!0,d=!1,O=f.computeFrenetFrames(h,!1),R=new P,I=new P,A=new P),d||(m=0,p=0,g=0,M=0);let b=o.extractPoints(c),y=b.shape,C=b.holes;if(!gs.isClockWise(y)){y=y.reverse();for(let j=0,ht=C.length;j<ht;j++){let w=C[j];gs.isClockWise(w)&&(C[j]=w.reverse())}}let B=gs.triangulateShape(y,C),z=y;for(let j=0,ht=C.length;j<ht;j++){let w=C[j];y=y.concat(w)}function W(j,ht,w){return ht||console.error("THREE.ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(ht,w)}let k=y.length,at=B.length;function G(j,ht,w){let Ut,ot,bt,ut=j.x-ht.x,kt=j.y-ht.y,wt=w.x-j.x,T=w.y-j.y,v=ut*ut+kt*kt,V=ut*T-kt*wt;if(Math.abs(V)>Number.EPSILON){let J=Math.sqrt(v),nt=Math.sqrt(wt*wt+T*T),K=ht.x-kt/J,Ct=ht.y+ut/J,yt=w.x-T/nt,gt=w.y+wt/nt,$t=((yt-K)*T-(gt-Ct)*wt)/(ut*T-kt*wt);Ut=K+ut*$t-j.x,ot=Ct+kt*$t-j.y;let st=Ut*Ut+ot*ot;if(st<=2)return new it(Ut,ot);bt=Math.sqrt(st/2)}else{let J=!1;ut>Number.EPSILON?wt>Number.EPSILON&&(J=!0):ut<-Number.EPSILON?wt<-Number.EPSILON&&(J=!0):Math.sign(kt)===Math.sign(T)&&(J=!0),J?(Ut=-kt,ot=ut,bt=Math.sqrt(v)):(Ut=ut,ot=kt,bt=Math.sqrt(v/2))}return new it(Ut/bt,ot/bt)}let dt=[];for(let j=0,ht=z.length,w=ht-1,Ut=j+1;j<ht;j++,w++,Ut++)w===ht&&(w=0),Ut===ht&&(Ut=0),dt[j]=G(z[j],z[w],z[Ut]);let ft=[],Rt,Ft=dt.concat();for(let j=0,ht=C.length;j<ht;j++){let w=C[j];Rt=[];for(let Ut=0,ot=w.length,bt=ot-1,ut=Ut+1;Ut<ot;Ut++,bt++,ut++)bt===ot&&(bt=0),ut===ot&&(ut=0),Rt[Ut]=G(w[Ut],w[bt],w[ut]);ft.push(Rt),Ft=Ft.concat(Rt)}for(let j=0;j<m;j++){let ht=j/m,w=p*Math.cos(ht*Math.PI/2),Ut=g*Math.sin(ht*Math.PI/2)+M;for(let ot=0,bt=z.length;ot<bt;ot++){let ut=W(z[ot],dt[ot],Ut);lt(ut.x,ut.y,-w)}for(let ot=0,bt=C.length;ot<bt;ot++){let ut=C[ot];Rt=ft[ot];for(let kt=0,wt=ut.length;kt<wt;kt++){let T=W(ut[kt],Rt[kt],Ut);lt(T.x,T.y,-w)}}}let Zt=g+M;for(let j=0;j<k;j++){let ht=d?W(y[j],Ft[j],Zt):y[j];x?(I.copy(O.normals[0]).multiplyScalar(ht.x),R.copy(O.binormals[0]).multiplyScalar(ht.y),A.copy(S[0]).add(I).add(R),lt(A.x,A.y,A.z)):lt(ht.x,ht.y,0)}for(let j=1;j<=h;j++)for(let ht=0;ht<k;ht++){let w=d?W(y[ht],Ft[ht],Zt):y[ht];x?(I.copy(O.normals[j]).multiplyScalar(w.x),R.copy(O.binormals[j]).multiplyScalar(w.y),A.copy(S[j]).add(I).add(R),lt(A.x,A.y,A.z)):lt(w.x,w.y,u/h*j)}for(let j=m-1;j>=0;j--){let ht=j/m,w=p*Math.cos(ht*Math.PI/2),Ut=g*Math.sin(ht*Math.PI/2)+M;for(let ot=0,bt=z.length;ot<bt;ot++){let ut=W(z[ot],dt[ot],Ut);lt(ut.x,ut.y,u+w)}for(let ot=0,bt=C.length;ot<bt;ot++){let ut=C[ot];Rt=ft[ot];for(let kt=0,wt=ut.length;kt<wt;kt++){let T=W(ut[kt],Rt[kt],Ut);x?lt(T.x,T.y+S[h-1].y,S[h-1].x+w):lt(T.x,T.y,u+w)}}}$(),ct();function $(){let j=s.length/3;if(d){let ht=0,w=k*ht;for(let Ut=0;Ut<at;Ut++){let ot=B[Ut];Bt(ot[2]+w,ot[1]+w,ot[0]+w)}ht=h+m*2,w=k*ht;for(let Ut=0;Ut<at;Ut++){let ot=B[Ut];Bt(ot[0]+w,ot[1]+w,ot[2]+w)}}else{for(let ht=0;ht<at;ht++){let w=B[ht];Bt(w[2],w[1],w[0])}for(let ht=0;ht<at;ht++){let w=B[ht];Bt(w[0]+k*h,w[1]+k*h,w[2]+k*h)}}n.addGroup(j,s.length/3-j,0)}function ct(){let j=s.length/3,ht=0;Tt(z,ht),ht+=z.length;for(let w=0,Ut=C.length;w<Ut;w++){let ot=C[w];Tt(ot,ht),ht+=ot.length}n.addGroup(j,s.length/3-j,1)}function Tt(j,ht){let w=j.length;for(;--w>=0;){let Ut=w,ot=w-1;ot<0&&(ot=j.length-1);for(let bt=0,ut=h+m*2;bt<ut;bt++){let kt=k*bt,wt=k*(bt+1),T=ht+Ut+kt,v=ht+ot+kt,V=ht+ot+wt,J=ht+Ut+wt;Ht(T,v,V,J)}}}function lt(j,ht,w){l.push(j),l.push(ht),l.push(w)}function Bt(j,ht,w){Gt(j),Gt(ht),Gt(w);let Ut=s.length/3,ot=E.generateTopUV(n,s,Ut-3,Ut-2,Ut-1);te(ot[0]),te(ot[1]),te(ot[2])}function Ht(j,ht,w,Ut){Gt(j),Gt(ht),Gt(Ut),Gt(ht),Gt(w),Gt(Ut);let ot=s.length/3,bt=E.generateSideWallUV(n,s,ot-6,ot-3,ot-2,ot-1);te(bt[0]),te(bt[1]),te(bt[3]),te(bt[1]),te(bt[2]),te(bt[3])}function Gt(j){s.push(l[j*3+0]),s.push(l[j*3+1]),s.push(l[j*3+2])}function te(j){r.push(j.x),r.push(j.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return Wg(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,a=t.shapes.length;r<a;r++){let o=e[t.shapes[r]];n.push(o)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new Fr[s.type]().fromJSON(s)),new i(n,t.options)}},Gg={generateTopUV:function(i,t,e,n,s){let r=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new it(r,a),new it(o,l),new it(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){let a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[s*3],p=t[s*3+1],g=t[s*3+2],M=t[r*3],m=t[r*3+1],f=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new it(a,1-l),new it(c,1-u),new it(d,1-g),new it(M,1-f)]:[new it(o,1-l),new it(h,1-u),new it(p,1-g),new it(m,1-f)]}};function Wg(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var Ls=class i extends De{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(a+o,Math.PI),c=0,h=[],u=new P,d=new P,p=[],g=[],M=[],m=[];for(let f=0;f<=n;f++){let E=[],S=f/n,x=0;f===0&&a===0?x=.5/e:f===n&&l===Math.PI&&(x=-.5/e);for(let O=0;O<=e;O++){let R=O/e;u.x=-t*Math.cos(s+R*r)*Math.sin(a+S*o),u.y=t*Math.cos(a+S*o),u.z=t*Math.sin(s+R*r)*Math.sin(a+S*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),M.push(d.x,d.y,d.z),m.push(R+x,1-S),E.push(c++)}h.push(E)}for(let f=0;f<n;f++)for(let E=0;E<e;E++){let S=h[f][E+1],x=h[f][E],O=h[f+1][E],R=h[f+1][E+1];(f!==0||a>0)&&p.push(S,x,R),(f!==n-1||l<Math.PI)&&p.push(x,O,R)}this.setIndex(p),this.setAttribute("position",new re(g,3)),this.setAttribute("normal",new re(M,3)),this.setAttribute("uv",new re(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var Ds=class i extends De{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);let a=[],o=[],l=[],c=[],h=new P,u=new P,d=new P;for(let p=0;p<=n;p++)for(let g=0;g<=s;g++){let M=g/s*r,m=p/n*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(M),u.y=(t+e*Math.cos(m))*Math.sin(M),u.z=e*Math.sin(m),o.push(u.x,u.y,u.z),h.x=t*Math.cos(M),h.y=t*Math.sin(M),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/s),c.push(p/n)}for(let p=1;p<=n;p++)for(let g=1;g<=s;g++){let M=(s+1)*p+g-1,m=(s+1)*(p-1)+g-1,f=(s+1)*(p-1)+g,E=(s+1)*p+g;a.push(M,m,E),a.push(m,f,E)}this.setIndex(a),this.setAttribute("position",new re(o,3)),this.setAttribute("normal",new re(l,3)),this.setAttribute("uv",new re(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}};var Or=class i extends De{constructor(t=new Ur(new P(-1,-1,0),new P(-1,1,0),new P(1,1,0)),e=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:s,closed:r};let a=t.computeFrenetFrames(e,r);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;let o=new P,l=new P,c=new it,h=new P,u=[],d=[],p=[],g=[];M(),this.setIndex(g),this.setAttribute("position",new re(u,3)),this.setAttribute("normal",new re(d,3)),this.setAttribute("uv",new re(p,2));function M(){for(let S=0;S<e;S++)m(S);m(r===!1?e:0),E(),f()}function m(S){h=t.getPointAt(S/e,h);let x=a.normals[S],O=a.binormals[S];for(let R=0;R<=s;R++){let I=R/s*Math.PI*2,A=Math.sin(I),b=-Math.cos(I);l.x=b*x.x+A*O.x,l.y=b*x.y+A*O.y,l.z=b*x.z+A*O.z,l.normalize(),d.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,u.push(o.x,o.y,o.z)}}function f(){for(let S=1;S<=e;S++)for(let x=1;x<=s;x++){let O=(s+1)*(S-1)+(x-1),R=(s+1)*S+(x-1),I=(s+1)*S+x,A=(s+1)*(S-1)+x;g.push(O,R,A),g.push(R,I,A)}}function E(){for(let S=0;S<=e;S++)for(let x=0;x<=s;x++)c.x=S/e,c.y=x/s,p.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new i(new Fr[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};var Br=class extends Ee{static get type(){return"RawShaderMaterial"}constructor(t){super(t),this.isRawShaderMaterial=!0}},ye=class extends ci{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Wt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Wt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jc,this.normalScale=new it(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},di=class extends ye{static get type(){return"MeshPhysicalMaterial"}constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new it(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return be(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Wt(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Wt(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Wt(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}};function ur(i,t,e){return!i||!e&&i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function Xg(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}var Ki=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let a;e:{i:if(!(t<s)){for(let o=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=e[++n],t<s)break t}a=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}a=n,n=0;break e}break n}for(;n<a;){let o=n+a>>>1;t<e[o]?a=o:n=o+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let a=0;a!==s;++a)e[a]=n[r+a];return e}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},Yo=class extends Ki{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Dl,endingEnd:Dl}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,a=t+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case Ul:r=t,o=2*e-n;break;case Nl:r=s.length-2,o=e+s[r]-s[r+1];break;default:r=t,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Ul:a=t,l=2*n-e;break;case Nl:a=1,l=n+s[1]-s[0];break;default:a=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,p=this._weightNext,g=(n-e)/(s-e),M=g*g,m=M*g,f=-d*m+2*d*M-d*g,E=(1+d)*m+(-1.5-2*d)*M+(-.5+d)*g+1,S=(-1-p)*m+(1.5+p)*M+.5*g,x=p*m-p*M;for(let O=0;O!==o;++O)r[O]=f*a[h+O]+E*a[c+O]+S*a[l+O]+x*a[u+O];return r}},Zo=class extends Ki{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(n-e)/(s-e),u=1-h;for(let d=0;d!==o;++d)r[d]=a[c+d]*u+a[l+d]*h;return r}},$o=class extends Ki{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},ln=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=ur(e,this.TimeBufferType),this.values=ur(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:ur(t.times,Array),values:ur(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new $o(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new Zo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new Yo(this.times,this.values,this.getValueSize(),t)}setInterpolation(t){let e;switch(t){case xr:e=this.InterpolantFactoryMethodDiscrete;break;case bo:e=this.InterpolantFactoryMethodLinear;break;case aa:e=this.InterpolantFactoryMethodSmooth;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return xr;case this.InterpolantFactoryMethodLinear:return bo;case this.InterpolantFactoryMethodSmooth:return aa}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t}return this}trim(t,e){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<t;)++r;for(;a!==-1&&n[a]>e;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==r;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),t=!1;break}a=l}if(s!==void 0&&Xg(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===aa,r=t.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let u=o*n,d=u-n,p=u+n;for(let g=0;g!==n;++g){let M=e[u+g];if(M!==e[d+g]||M!==e[p+g]){l=!0;break}}}if(l){if(o!==a){t[a]=t[o];let u=o*n,d=a*n;for(let p=0;p!==n;++p)e[d+p]=e[u+p]}++a}}if(r>0){t[a]=t[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)e[l+c]=e[o+c];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,s}};ln.prototype.TimeBufferType=Float32Array;ln.prototype.ValueBufferType=Float32Array;ln.prototype.DefaultInterpolation=bo;var fi=class extends ln{constructor(t,e,n){super(t,e,n)}};fi.prototype.ValueTypeName="bool";fi.prototype.ValueBufferType=Array;fi.prototype.DefaultInterpolation=xr;fi.prototype.InterpolantFactoryMethodLinear=void 0;fi.prototype.InterpolantFactoryMethodSmooth=void 0;var Jo=class extends ln{};Jo.prototype.ValueTypeName="color";var Ko=class extends ln{};Ko.prototype.ValueTypeName="number";var Qo=class extends Ki{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-e)/(s-e),c=t*o;for(let h=c+o;c!==h;c+=4)Xn.slerpFlat(r,0,a,c-o,a,c,l);return r}},zr=class extends ln{InterpolantFactoryMethodLinear(t){return new Qo(this.times,this.values,this.getValueSize(),t)}};zr.prototype.ValueTypeName="quaternion";zr.prototype.InterpolantFactoryMethodSmooth=void 0;var pi=class extends ln{constructor(t,e,n){super(t,e,n)}};pi.prototype.ValueTypeName="string";pi.prototype.ValueBufferType=Array;pi.prototype.DefaultInterpolation=xr;pi.prototype.InterpolantFactoryMethodLinear=void 0;pi.prototype.InterpolantFactoryMethodSmooth=void 0;var jo=class extends ln{};jo.prototype.ValueTypeName="vector";var kr={enabled:!1,files:{},add:function(i,t){this.enabled!==!1&&(this.files[i]=t)},get:function(i){if(this.enabled!==!1)return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}},tl=class{constructor(t,e,n){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=c.length;u<d;u+=2){let p=c[u],g=c[u+1];if(p.global&&(p.lastIndex=0),p.test(h))return g}return null}}},qg=new tl,mi=class{constructor(t){this.manager=t!==void 0?t:qg,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}};mi.DEFAULT_MATERIAL_NAME="__DEFAULT";var Sn={},el=class extends Error{constructor(t,e){super(t),this.response=e}},nl=class extends mi{constructor(t){super(t)}load(t,e,n,s){t===void 0&&(t=""),this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);let r=kr.get(t);if(r!==void 0)return this.manager.itemStart(t),setTimeout(()=>{e&&e(r),this.manager.itemEnd(t)},0),r;if(Sn[t]!==void 0){Sn[t].push({onLoad:e,onProgress:n,onError:s});return}Sn[t]=[],Sn[t].push({onLoad:e,onProgress:n,onError:s});let a=new Request(t,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let h=Sn[t],u=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),p=d?parseInt(d):0,g=p!==0,M=0,m=new ReadableStream({start(f){E();function E(){u.read().then(({done:S,value:x})=>{if(S)f.close();else{M+=x.byteLength;let O=new ProgressEvent("progress",{lengthComputable:g,loaded:M,total:p});for(let R=0,I=h.length;R<I;R++){let A=h[R];A.onProgress&&A.onProgress(O)}f.enqueue(x),E()}},S=>{f.error(S)})}}});return new Response(m)}else throw new el(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,o));case"json":return c.json();default:if(o===void 0)return c.text();{let u=/charset="?([^;"\s]*)"?/i.exec(o),d=u&&u[1]?u[1].toLowerCase():void 0,p=new TextDecoder(d);return c.arrayBuffer().then(g=>p.decode(g))}}}).then(c=>{kr.add(t,c);let h=Sn[t];delete Sn[t];for(let u=0,d=h.length;u<d;u++){let p=h[u];p.onLoad&&p.onLoad(c)}}).catch(c=>{let h=Sn[t];if(h===void 0)throw this.manager.itemError(t),c;delete Sn[t];for(let u=0,d=h.length;u<d;u++){let p=h[u];p.onError&&p.onError(c)}this.manager.itemError(t)}).finally(()=>{this.manager.itemEnd(t)}),this.manager.itemStart(t)}setResponseType(t){return this.responseType=t,this}setMimeType(t){return this.mimeType=t,this}};var il=class extends mi{constructor(t){super(t)}load(t,e,n,s){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);let r=this,a=kr.get(t);if(a!==void 0)return r.manager.itemStart(t),setTimeout(function(){e&&e(a),r.manager.itemEnd(t)},0),a;let o=ys("img");function l(){h(),kr.add(t,this),e&&e(this),r.manager.itemEnd(t)}function c(u){h(),s&&s(u),r.manager.itemError(t),r.manager.itemEnd(t)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),r.manager.itemStart(t),o.src=t,o}};var Hr=class extends mi{constructor(t){super(t)}load(t,e,n,s){let r=this,a=new ko,o=new nl(this.manager);return o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setPath(this.path),o.setWithCredentials(r.withCredentials),o.load(t,function(l){let c;try{c=r.parse(l)}catch(h){if(s!==void 0)s(h);else{console.error(h);return}}c.image!==void 0?a.image=c.image:c.data!==void 0&&(a.image.width=c.width,a.image.height=c.height,a.image.data=c.data),a.wrapS=c.wrapS!==void 0?c.wrapS:An,a.wrapT=c.wrapT!==void 0?c.wrapT:An,a.magFilter=c.magFilter!==void 0?c.magFilter:Le,a.minFilter=c.minFilter!==void 0?c.minFilter:Le,a.anisotropy=c.anisotropy!==void 0?c.anisotropy:1,c.colorSpace!==void 0&&(a.colorSpace=c.colorSpace),c.flipY!==void 0&&(a.flipY=c.flipY),c.format!==void 0&&(a.format=c.format),c.type!==void 0&&(a.type=c.type),c.mipmaps!==void 0&&(a.mipmaps=c.mipmaps,a.minFilter=Hn),c.mipmapCount===1&&(a.minFilter=Le),c.generateMipmaps!==void 0&&(a.generateMipmaps=c.generateMipmaps),a.needsUpdate=!0,e&&e(a,c)},n,s),a}},Vr=class extends mi{constructor(t){super(t)}load(t,e,n,s){let r=new Oe,a=new il(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(t,function(o){r.image=o,r.needsUpdate=!0,e!==void 0&&e(r)},n,s),r}},Us=class extends Ve{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Wt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}};var Fa=new _e,Uc=new P,Nc=new P,Gr=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new it(512,512),this.map=null,this.mapPass=null,this.matrix=new _e,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new bs,this._frameExtents=new it(1,1),this._viewportCount=1,this._viewports=[new he(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;Uc.setFromMatrixPosition(t.matrixWorld),e.position.copy(Uc),Nc.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Nc),e.updateMatrixWorld(),Fa.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Fa),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Fa)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}};var Fc=new _e,ls=new P,Oa=new P,sl=class extends Gr{constructor(){super(new Pe(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new it(4,2),this._viewportCount=6,this._viewports=[new he(2,1,1,1),new he(0,1,1,1),new he(3,1,1,1),new he(1,1,1,1),new he(3,0,1,1),new he(1,0,1,1)],this._cubeDirections=[new P(1,0,0),new P(-1,0,0),new P(0,0,1),new P(0,0,-1),new P(0,1,0),new P(0,-1,0)],this._cubeUps=[new P(0,1,0),new P(0,1,0),new P(0,1,0),new P(0,1,0),new P(0,0,1),new P(0,0,-1)]}updateMatrices(t,e=0){let n=this.camera,s=this.matrix,r=t.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),ls.setFromMatrixPosition(t.matrixWorld),n.position.copy(ls),Oa.copy(n.position),Oa.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt(Oa),n.updateMatrixWorld(),s.makeTranslation(-ls.x,-ls.y,-ls.z),Fc.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Fc)}},Qi=class extends Us{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new sl}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}},rl=class extends Gr{constructor(){super(new Zi(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Ns=class extends Us{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ve.DEFAULT_UP),this.updateMatrix(),this.target=new Ve,this.shadow=new rl}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}},Wr=class extends Us{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}};var Xr=class{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=Oc(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){let e=Oc();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}};function Oc(){return performance.now()}var Tl="\\[\\]\\.:\\/",Yg=new RegExp("["+Tl+"]","g"),wl="[^"+Tl+"]",Zg="[^"+Tl.replace("\\.","")+"]",$g=/((?:WC+[\/:])*)/.source.replace("WC",wl),Jg=/(WCOD+)?/.source.replace("WCOD",Zg),Kg=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",wl),Qg=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",wl),jg=new RegExp("^"+$g+Jg+Kg+Qg+"$"),t0=["material","materials","bones","map"],al=class{constructor(t,e,n){let s=n||ge.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},ge=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(Yg,"")}static parseTrackName(t){let e=jg.exec(t);if(e===null)throw new Error("PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);t0.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===e||o.uuid===e)return o;let l=n(o.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let a=t[s];if(a===void 0){let c=e.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:t.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};ge.Composite=al;ge.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ge.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ge.prototype.GetterByBindingType=[ge.prototype._getValue_direct,ge.prototype._getValue_array,ge.prototype._getValue_arrayElement,ge.prototype._getValue_toArray];ge.prototype.SetterByBindingTypeAndVersioning=[[ge.prototype._setValue_direct,ge.prototype._setValue_direct_setNeedsUpdate,ge.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ge.prototype._setValue_array,ge.prototype._setValue_array_setNeedsUpdate,ge.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ge.prototype._setValue_arrayElement,ge.prototype._setValue_arrayElement_setNeedsUpdate,ge.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ge.prototype._setValue_fromArray,ge.prototype._setValue_fromArray_setNeedsUpdate,ge.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var l0=new Float32Array(1);var Bc=new _e,qr=class{constructor(t,e,n=0,s=1/0){this.ray=new Sr(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Ss,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return Bc.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Bc),this}intersectObject(t,e=!0,n=[]){return ol(t,this,n,e),n.sort(zc),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)ol(t[s],this,n,e);return n.sort(zc),n}};function zc(i,t){return i.distance-t.distance}function ol(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let a=0,o=r.length;a<o;a++)ol(r[a],t,e,!0)}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:ll}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ll);var Kr=class extends Hr{constructor(t){super(t),this.type=Ue}parse(t){let a=function(A,b){switch(A){case 1:throw new Error("THREE.RGBELoader: Read Error: "+(b||""));case 2:throw new Error("THREE.RGBELoader: Write Error: "+(b||""));case 3:throw new Error("THREE.RGBELoader: Bad File Format: "+(b||""));default:case 4:throw new Error("THREE.RGBELoader: Memory Error: "+(b||""))}},h=`
`,u=function(A,b,y){b=b||1024;let H=A.pos,B=-1,z=0,W="",k=String.fromCharCode.apply(null,new Uint16Array(A.subarray(H,H+128)));for(;0>(B=k.indexOf(h))&&z<b&&H<A.byteLength;)W+=k,z+=k.length,H+=128,k+=String.fromCharCode.apply(null,new Uint16Array(A.subarray(H,H+128)));return-1<B?(y!==!1&&(A.pos+=z+B+1),W+k.slice(0,B)):!1},d=function(A){let b=/^#\?(\S+)/,y=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,C=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,H=/^\s*FORMAT=(\S+)\s*$/,B=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,z={valid:0,string:"",comments:"",programtype:"RGBE",format:"",gamma:1,exposure:1,width:0,height:0},W,k;for((A.pos>=A.byteLength||!(W=u(A)))&&a(1,"no header found"),(k=W.match(b))||a(3,"bad initial token"),z.valid|=1,z.programtype=k[1],z.string+=W+`
`;W=u(A),W!==!1;){if(z.string+=W+`
`,W.charAt(0)==="#"){z.comments+=W+`
`;continue}if((k=W.match(y))&&(z.gamma=parseFloat(k[1])),(k=W.match(C))&&(z.exposure=parseFloat(k[1])),(k=W.match(H))&&(z.valid|=2,z.format=k[1]),(k=W.match(B))&&(z.valid|=4,z.height=parseInt(k[1],10),z.width=parseInt(k[2],10)),z.valid&2&&z.valid&4)break}return z.valid&2||a(3,"missing format specifier"),z.valid&4||a(3,"missing image size specifier"),z},p=function(A,b,y){let C=b;if(C<8||C>32767||A[0]!==2||A[1]!==2||A[2]&128)return new Uint8Array(A);C!==(A[2]<<8|A[3])&&a(3,"wrong scanline width");let H=new Uint8Array(4*b*y);H.length||a(4,"unable to allocate buffer space");let B=0,z=0,W=4*C,k=new Uint8Array(4),at=new Uint8Array(W),G=y;for(;G>0&&z<A.byteLength;){z+4>A.byteLength&&a(1),k[0]=A[z++],k[1]=A[z++],k[2]=A[z++],k[3]=A[z++],(k[0]!=2||k[1]!=2||(k[2]<<8|k[3])!=C)&&a(3,"bad rgbe scanline format");let dt=0,ft;for(;dt<W&&z<A.byteLength;){ft=A[z++];let Ft=ft>128;if(Ft&&(ft-=128),(ft===0||dt+ft>W)&&a(3,"bad scanline data"),Ft){let Zt=A[z++];for(let $=0;$<ft;$++)at[dt++]=Zt}else at.set(A.subarray(z,z+ft),dt),dt+=ft,z+=ft}let Rt=C;for(let Ft=0;Ft<Rt;Ft++){let Zt=0;H[B]=at[Ft+Zt],Zt+=C,H[B+1]=at[Ft+Zt],Zt+=C,H[B+2]=at[Ft+Zt],Zt+=C,H[B+3]=at[Ft+Zt],B+=4}G--}return H},g=function(A,b,y,C){let H=A[b+3],B=Math.pow(2,H-128)/255;y[C+0]=A[b+0]*B,y[C+1]=A[b+1]*B,y[C+2]=A[b+2]*B,y[C+3]=1},M=function(A,b,y,C){let H=A[b+3],B=Math.pow(2,H-128)/255;y[C+0]=Os.toHalfFloat(Math.min(A[b+0]*B,65504)),y[C+1]=Os.toHalfFloat(Math.min(A[b+1]*B,65504)),y[C+2]=Os.toHalfFloat(Math.min(A[b+2]*B,65504)),y[C+3]=Os.toHalfFloat(1)},m=new Uint8Array(t);m.pos=0;let f=d(m),E=f.width,S=f.height,x=p(m.subarray(m.pos),E,S),O,R,I;switch(this.type){case qe:I=x.length/4;let A=new Float32Array(I*4);for(let y=0;y<I;y++)g(x,y*4,A,y*4);O=A,R=qe;break;case Ue:I=x.length/4;let b=new Uint16Array(I*4);for(let y=0;y<I;y++)M(x,y*4,b,y*4);O=b,R=Ue;break;default:throw new Error("THREE.RGBELoader: Unsupported type: "+this.type)}return{width:E,height:S,data:O,header:f.string,gamma:f.gamma,exposure:f.exposure,type:R}}setDataType(t){return this.type=t,this}load(t,e,n,s){function r(a,o){switch(a.type){case qe:case Ue:a.colorSpace=qn,a.minFilter=Le,a.magFilter=Le,a.generateMipmaps=!1,a.flipY=!0;break}e&&e(a,o)}return super.load(t,r,n,s)}};var Bs=new P;function en(i,t,e,n,s,r){let a=2*Math.PI*s/4,o=Math.max(r-2*s,0),l=Math.PI/4;Bs.copy(t),Bs[n]=0,Bs.normalize();let c=.5*a/(a+o),h=1-Bs.angleTo(i)/l;return Math.sign(Bs[e])===1?h*c:o/(a+o)+c+c*(1-h)}var Zn=class extends Ze{constructor(t=1,e=1,n=1,s=2,r=.1){if(s=s*2+1,r=Math.min(t/2,e/2,n/2,r),super(1,1,1,s,s,s),s===1)return;let a=this.toNonIndexed();this.index=null,this.attributes.position=a.attributes.position,this.attributes.normal=a.attributes.normal,this.attributes.uv=a.attributes.uv;let o=new P,l=new P,c=new P(t,e,n).divideScalar(2).subScalar(r),h=this.attributes.position.array,u=this.attributes.normal.array,d=this.attributes.uv.array,p=h.length/6,g=new P,M=.5/s;for(let m=0,f=0;m<h.length;m+=3,f+=2)switch(o.fromArray(h,m),l.copy(o),l.x-=Math.sign(l.x)*M,l.y-=Math.sign(l.y)*M,l.z-=Math.sign(l.z)*M,l.normalize(),h[m+0]=c.x*Math.sign(o.x)+l.x*r,h[m+1]=c.y*Math.sign(o.y)+l.y*r,h[m+2]=c.z*Math.sign(o.z)+l.z*r,u[m+0]=l.x,u[m+1]=l.y,u[m+2]=l.z,Math.floor(m/p)){case 0:g.set(1,0,0),d[f+0]=en(g,l,"z","y",r,n),d[f+1]=1-en(g,l,"y","z",r,e);break;case 1:g.set(-1,0,0),d[f+0]=1-en(g,l,"z","y",r,n),d[f+1]=1-en(g,l,"y","z",r,e);break;case 2:g.set(0,1,0),d[f+0]=1-en(g,l,"x","z",r,t),d[f+1]=en(g,l,"z","x",r,n);break;case 3:g.set(0,-1,0),d[f+0]=1-en(g,l,"x","z",r,t),d[f+1]=1-en(g,l,"z","x",r,n);break;case 4:g.set(0,0,1),d[f+0]=1-en(g,l,"x","y",r,t),d[f+1]=1-en(g,l,"y","x",r,e);break;case 5:g.set(0,0,-1),d[f+0]=en(g,l,"x","y",r,t),d[f+1]=1-en(g,l,"y","x",r,e);break}}};var Qr={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var Je=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},n0=new Zi(-1,1,1,-1,0,1),Al=class extends De{constructor(){super(),this.setAttribute("position",new re([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new re([0,2,0,0,2,0],2))}},i0=new Al,$n=class{constructor(t){this._mesh=new Vt(i0,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,n0)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}};var jr=class extends Je{constructor(t,e){super(),this.textureID=e!==void 0?e:"tDiffuse",t instanceof Ee?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=Yn.clone(t.uniforms),this.material=new Ee({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this.fsQuad=new $n(this.material)}render(t,e,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this.fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this.fsQuad.render(t))}dispose(){this.material.dispose(),this.fsQuad.dispose()}};var zs=class extends Je{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,n){let s=t.getContext(),r=t.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),t.setRenderTarget(n),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}},ta=class extends Je{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}};var ea=class{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){let n=t.getSize(new it);this._width=n.width,this._height=n.height,e=new Be(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Ue}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new jr(Qr),this.copyPass.material.blending=dn,this.clock=new Xr}swapBuffers(){let t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){let e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){t===void 0&&(t=this.clock.getDelta());let e=this.renderer.getRenderTarget(),n=!1;for(let s=0,r=this.passes.length;s<r;s++){let a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,t,n),a.needsSwap){if(n){let o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}zs!==void 0&&(a instanceof zs?n=!0:a instanceof ta&&(n=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){let e=this.renderer.getSize(new it);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;let n=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(n,s),this.renderTarget2.setSize(n,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,s)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var na=class extends Je{constructor(t,e,n=null,s=null,r=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=n,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new Wt}render(t,e,n){let s=t.autoClear;t.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(r=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),t.autoClear=s}};var dh={name:"LuminosityHighPassShader",shaderID:"luminosityHighPass",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Wt(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var ts=class i extends Je{constructor(t,e,n,s){super(),this.strength=e!==void 0?e:1,this.radius=n,this.threshold=s,this.resolution=t!==void 0?new it(t.x,t.y):new it(256,256),this.clearColor=new Wt(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new Be(r,a,{type:Ue}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){let d=new Be(r,a,{type:Ue});d.texture.name="UnrealBloomPass.h"+u,d.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(d);let p=new Be(r,a,{type:Ue});p.texture.name="UnrealBloomPass.v"+u,p.texture.generateMipmaps=!1,this.renderTargetsVertical.push(p),r=Math.round(r/2),a=Math.round(a/2)}let o=dh;this.highPassUniforms=Yn.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new Ee({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let l=[3,5,7,9,11];r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(l[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new it(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new P(1,1,1),new P(1,1,1),new P(1,1,1),new P(1,1,1),new P(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;let h=Qr;this.copyUniforms=Yn.clone(h.uniforms),this.blendMaterial=new Ee({uniforms:this.copyUniforms,vertexShader:h.vertexShader,fragmentShader:h.fragmentShader,blending:_r,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new Wt,this.oldClearAlpha=1,this.basic=new pn,this.fsQuad=new $n(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(t,e){let n=Math.round(t/2),s=Math.round(e/2);this.renderTargetBright.setSize(n,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,s),this.renderTargetsVertical[r].setSize(n,s),this.separableBlurMaterials[r].uniforms.invSize.value=new it(1/n,1/s),n=Math.round(n/2),s=Math.round(s/2)}render(t,e,n,s,r){t.getClearColor(this._oldClearColor),this.oldClearAlpha=t.getClearAlpha();let a=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),r&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=n.texture,t.setRenderTarget(null),t.clear(),this.fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this.fsQuad.render(t);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[l]),t.clear(),this.fsQuad.render(t),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=i.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[l]),t.clear(),this.fsQuad.render(t),o=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this.fsQuad.render(t),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(n),this.fsQuad.render(t)),t.setClearColor(this._oldClearColor,this.oldClearAlpha),t.autoClear=a}getSeperableBlurMaterial(t){let e=[];for(let n=0;n<t;n++)e.push(.39894*Math.exp(-.5*n*n/(t*t))/t);return new Ee({defines:{KERNEL_RADIUS:t},uniforms:{colorTexture:{value:null},invSize:{value:new it(.5,.5)},direction:{value:new it(.5,.5)},gaussianCoefficients:{value:e}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(t){return new Ee({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}};ts.BlurDirectionX=new it(1,0);ts.BlurDirectionY=new it(0,1);var fh={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var ia=class extends Je{constructor(){super();let t=fh;this.uniforms=Yn.clone(t.uniforms),this.material=new Br({name:t.name,uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader}),this.fsQuad=new $n(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},ie.getTransfer(this._outputColorSpace)===le&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===hl?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===ul?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===dl?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Fs?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===fl?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===pl&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this.fsQuad.render(t))}dispose(){this.material.dispose(),this.fsQuad.dispose()}};var Pn=4.6,_i=1.68,Rl=.16,xi='"Michroma", "Segoe UI", Arial, sans-serif';function ph(i,t,e,n=0,s=0){let r=new As,a=n-i/2,o=s-t/2;return r.moveTo(a+e,o),r.lineTo(a+i-e,o),r.quadraticCurveTo(a+i,o,a+i,o+e),r.lineTo(a+i,o+t-e),r.quadraticCurveTo(a+i,o+t,a+i-e,o+t),r.lineTo(a+e,o+t),r.quadraticCurveTo(a,o+t,a,o+t-e),r.lineTo(a,o+e),r.quadraticCurveTo(a,o,a+e,o),r}function s0(i,t,e){let n=new Ji,s=-i/2,r=-t/2;return n.moveTo(s+e,r),n.lineTo(s+i-e,r),n.quadraticCurveTo(s+i,r,s+i,r+e),n.lineTo(s+i,r+t-e),n.quadraticCurveTo(s+i,r+t,s+i-e,r+t),n.lineTo(s+e,r+t),n.quadraticCurveTo(s,r+t,s,r+t-e),n.lineTo(s,r+e),n.quadraticCurveTo(s,r,s+e,r),n}var mh=i=>(Math.pow(10,i/20)-.1)/(Math.pow(10,3/20)-.1),gh=.86;async function r0(i,t={}){let e=t.base||"assets/",n=new Rr({canvas:i,antialias:!0,alpha:!1,powerPreference:"high-performance"});n.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),n.toneMapping=Fs,n.toneMappingExposure=1,n.outputColorSpace=Ie,n.shadowMap.enabled=!0,n.shadowMap.type=cl;let s=new Cr;s.background=new Wt(461067);let r=new Pe(20,2.6,.1,100);try{let X=new FontFace("Michroma",`url(${e}michroma.ttf)`);document.fonts.add(await X.load())}catch{}let a=new Vr,o=n.capabilities.getMaxAnisotropy(),l=(X,Z,Y)=>new Promise(rt=>a.load(e+X,Et=>{Et.wrapS=Et.wrapT=_s,Y&&Et.repeat.set(Y[0],Y[1]),Et.anisotropy=o,Z&&(Et.colorSpace=Ie),rt(Et)},void 0,()=>rt(null))),c=[Pn/1.15,_i/1.15],[h,u,d,p,g,M,m,f]=await Promise.all([l("metal_col.jpg",!0,c),l("metal_nrm.jpg",!1,c),l("metal_rgh.jpg",!1,c),l("knob_col.jpg",!0),l("knob_nrm.jpg",!1),l("knob_rgh.jpg",!1),l("paper.jpg",!0),new Promise(X=>new Kr().load(e+"studio.hdr",X,void 0,()=>X(null)))]);if(f){let X=new $i(n);s.environment=X.fromEquirectangular(f).texture,f.dispose(),X.dispose()}let E={panel:new ye({color:8752019,map:h,normalMap:u,normalScale:new it(1,1),roughnessMap:d,roughness:.58,metalness:.9,envMapIntensity:1.05}),blackAnod:new ye({color:1382170,metalness:.75,roughness:.32,envMapIntensity:1}),chrome:new ye({color:14278114,metalness:1,roughness:.16,envMapIntensity:1.25}),satin:new ye({color:12896719,metalness:1,roughness:.32,envMapIntensity:1.1}),hole:new ye({color:197379,metalness:0,roughness:.9}),rubber:new ye({color:1118740,metalness:0,roughness:.62,envMapIntensity:.6}),matteBlack:new ye({color:328966,metalness:.05,roughness:.92}),glass:new di({color:16777215,metalness:0,roughness:.04,transparent:!0,opacity:.16,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:2.2,depthWrite:!1}),vfdGlass:new di({color:798247,metalness:0,roughness:.03,transparent:!0,opacity:.3,clearcoat:1,envMapIntensity:1.4,depthWrite:!1}),knobCap:new ye({color:15659508,map:p,normalMap:g,normalScale:new it(.25,.25),roughness:.3,metalness:1,envMapIntensity:1.35})},S=new ve;s.add(S);let x=(X,Z=0,Y=0,rt=0,Et=S,Dt=!0)=>(X.position.set(Z,Y,rt),Dt&&(X.castShadow=!0,X.receiveShadow=!0),Et.add(X),X),O=new Vt(new $e(40,20),new ye({color:724240,roughness:.95,metalness:0}));O.position.z=-Rl-.02,O.receiveShadow=!0,s.add(O);let R=x(new Vt(new Zn(Pn,_i,Rl,5,.035),E.panel),0,0,-Rl/2);R.castShadow=!0;let I=new Ns(16774118,2.1);I.position.set(-2.5,3.2,4.5),I.castShadow=!0,I.shadow.mapSize.set(2048,2048),I.shadow.camera.left=-3.2,I.shadow.camera.right=3.2,I.shadow.camera.top=1.8,I.shadow.camera.bottom=-1.8,I.shadow.camera.near=.5,I.shadow.camera.far=12,I.shadow.radius=4,I.shadow.bias=-4e-4,I.shadow.normalBias=.01,s.add(I);let A=new Ns(12572415,.35);A.position.set(3,-1,3),s.add(A),s.add(new Wr(16777215,.06));function b(X,Z,Y,rt,Et,Dt){let tt=ph(X+2*rt,Z+2*rt,Y+rt);tt.holes.push(s0(X,Z,Y));let _t=new Ps(tt,{depth:Et,bevelEnabled:!0,bevelThickness:.008,bevelSize:.008,bevelSegments:3,curveSegments:10});return new Vt(_t,Dt)}function y(X,Z,Y=S){let rt=new ve,Et=[new it(0,.017),new it(.02,.016),new it(.031,.009),new it(.034,.002),new it(.034,0)],Dt=new Vt(new ws(Et,28),E.satin);Dt.rotation.x=Math.PI/2,Dt.castShadow=!0,rt.add(Dt);let tt=new ye({color:1710618,roughness:.8,metalness:.4}),_t=new Vt(new Ze(.044,.008,.01),tt),Lt=_t.clone();return Lt.rotation.z=Math.PI/2,_t.position.z=Lt.position.z=.014,rt.add(_t,Lt),rt.rotation.z=Math.random()*Math.PI,rt.position.set(X,Z,.001),Y.add(rt),rt}function C(X,Z,Y){let rt=document.createElement("canvas");rt.width=X,rt.height=Z;let Et=rt.getContext("2d");Y(Et,X,Z);let Dt=new Ir(rt);return Dt.colorSpace=Ie,Dt.anisotropy=o,{t:Dt,c:rt,ctx:Et}}for(let X of[-1,1]){let Z=X*(Pn/2-.11);for(let Y of[-1,1]){let rt=x(new Vt(new Ps(ph(.1,.2,.05),{depth:.004,bevelEnabled:!1}),E.hole),Z,Y*.56,5e-4,S,!1);rt.receiveShadow=!0,y(Z,Y*.56+(Y>0?-.03:.03))}}let H=.86,B=.56;function z(X){let Y=Math.round(1024*B/H),rt=1024/H,Et=1024/2,Dt=Y+.07*rt;return C(1024,Y,tt=>{m&&m.image?(tt.drawImage(m.image,0,0,1024,Y),tt.fillStyle="rgba(244, 214, 160, 0.62)",tt.fillRect(0,0,1024,Y)):(tt.fillStyle="#f3e3bd",tt.fillRect(0,0,1024,Y));let _t=tt.createRadialGradient(1024/2,Y*1.1,60,1024/2,Y*.9,1024*.75);_t.addColorStop(0,"rgba(255,240,200,0.0)"),_t.addColorStop(1,"rgba(70,40,10,0.33)"),tt.fillStyle=_t,tt.fillRect(0,0,1024,Y);let Lt=(L,F)=>{let U=(mh(L)*2-1)*gh;return[Et+F*Math.sin(U),Dt-F*Math.cos(U)]},_=.43*rt;tt.lineCap="butt",tt.strokeStyle="#1c1712",tt.lineWidth=4,tt.beginPath();for(let L=-20;L<=.001;L+=.25){let[F,U]=Lt(L,_);L===-20?tt.moveTo(F,U):tt.lineTo(F,U)}tt.stroke(),tt.strokeStyle="#c4271d",tt.lineWidth=14,tt.beginPath();for(let L=0;L<=3.001;L+=.1){let[F,U]=Lt(L,_+7);L===0?tt.moveTo(F,U):tt.lineTo(F,U)}tt.stroke();let D=[-20,-10,-7,-5,-3,-2,-1,0,1,2,3];for(let L of D){let[F,U]=Lt(L,_-2),[et,pt]=Lt(L,_+34);tt.strokeStyle=L>0?"#c4271d":"#1c1712",tt.lineWidth=L===0?6:4,tt.beginPath(),tt.moveTo(F,U),tt.lineTo(et,pt),tt.stroke();let[It,Pt]=Lt(L,_+68);tt.fillStyle=L>0?"#c4271d":"#1c1712",tt.font=`600 ${L===0?40:32}px ${xi}`,tt.textAlign="center",tt.textBaseline="middle",tt.fillText(L>0?"+"+L:String(Math.abs(L)),It,Pt)}for(let L=-20;L<3;L+=1){if(D.includes(L)||L<-10&&L%2)continue;let[F,U]=Lt(L,_-2),[et,pt]=Lt(L,_+16);tt.strokeStyle=L>0?"#c4271d":"#1c1712",tt.lineWidth=2.5,tt.beginPath(),tt.moveTo(F,U),tt.lineTo(et,pt),tt.stroke()}tt.strokeStyle="#1c1712",tt.lineWidth=2,tt.beginPath();for(let L=-20;L<=3.001;L+=.25){let[F,U]=Lt(L,_-46);L===-20?tt.moveTo(F,U):tt.lineTo(F,U)}tt.stroke();for(let L=0;L<=100;L+=20){let F=20*Math.log10(L/100*(Math.pow(10,.15)-.1)+.1),[U,et]=Lt(F,_-46),[pt,It]=Lt(F,_-60);tt.beginPath(),tt.moveTo(U,et),tt.lineTo(pt,It),tt.stroke();let[Pt,Yt]=Lt(F,_-82);tt.font=`500 20px ${xi}`,tt.fillStyle="#3a3128",tt.fillText(String(L),Pt,Yt)}tt.fillStyle="#1c1712",tt.font=`600 66px ${xi}`,tt.textAlign="center",tt.fillText("VU",1024/2,Y*.6),tt.font=`500 15px ${xi}`,tt.textAlign="left",tt.fillStyle="#6a5d4d",tt.fillText("SG-1",34,Y*.7)})}function W(X,Z,Y){let rt=new ve;rt.position.set(X,Z,0),S.add(rt);let Et=z(Y),Dt=new ye({map:Et.t,emissiveMap:Et.t,emissive:new Wt(16758886),emissiveIntensity:.3,roughness:.85,metalness:0});x(new Vt(new $e(H,B),Dt),0,0,.004,rt,!1).receiveShadow=!0,x(b(H,B,.02,.035,.05,E.blackAnod),0,0,0,rt);let tt=new ve;tt.position.set(0,-B/2-.07,.016),rt.add(tt);let _t=new Ze(.0055,.52,.002);_t.translate(0,.26,0);let Lt=new Vt(_t,new ye({color:855309,roughness:.5}));Lt.castShadow=!0,tt.add(Lt);let _=new Ze(.0055,.09,.0021);_.translate(0,.475,2e-4),tt.add(new Vt(_,new ye({color:11542038,roughness:.5})));let D=x(new Vt(new Zn(H,.11,.03,3,.01),E.matteBlack),0,-B/2+.05,.025,rt);D.castShadow=!1;let L=new Vt(new mn(.012,.012,.006,16),E.satin);L.rotation.x=Math.PI/2,x(L,0,-B/2+.05,.042,rt,!1),x(new Vt(new $e(H+.02,B+.02),E.glass),0,0,.052,rt,!1);let F=new Qi(16757850,.1,.5,2);return F.position.set(0,-B/2+.06,.03),rt.add(F),{g:rt,pivot:tt,x:0,v:0,faceMat:Dt,lamp:F}}function k(X,Z){let Y=new ve;Y.position.set(X,Z,0),S.add(Y);let rt=12,Et=.047,Dt=rt*Et+.03;x(b(.07,Dt,.012,.018,.022,E.blackAnod),0,0,0,Y),x(new Vt(new $e(.07,Dt),E.hole),0,0,.003,Y,!1);let tt=[];for(let _t=0;_t<rt;_t++){let Lt=_t>=10?16722466:_t>=8?16753182:4063082,_=new ye({color:987408,emissive:new Wt(Lt),emissiveIntensity:.05,roughness:.25,metalness:0}),D=x(new Vt(new Zn(.05,.03,.016,2,.006),_),0,-Dt/2+.03+_t*Et,.01,Y,!1);tt.push(D)}return{g:Y,leds:tt,lvl:0,peak:0,peakT:0}}function at(X,Z){let Y=new ve;Y.position.set(X,Z,0),S.add(Y);let rt=new ve;Y.add(rt);let Et=[[0,0],[.19,0],[.19,.012],[.158,.02],[.152,.03],[.15,.088],[.138,.101],[0,.101]].map(([D,L])=>new it(D,L)),Dt=new Vt(new ws(Et,64),E.blackAnod);Dt.rotation.x=Math.PI/2,Dt.castShadow=!0,Dt.receiveShadow=!0,rt.add(Dt);let tt=new Ze(.008,.012,.055);for(let D=0;D<48;D++){let L=D/48*Math.PI*2,F=new Vt(tt,E.blackAnod);F.position.set(Math.cos(L)*.151,Math.sin(L)*.151,.058),F.rotation.z=L,rt.add(F)}let _t=new Vt(new hi(.136,64),E.knobCap);_t.position.z=.1015,rt.add(_t);let Lt=new Vt(new Ze(.012,.075,.003),new ye({color:16777215,emissive:16777215,emissiveIntensity:.25,roughness:.4}));Lt.position.set(0,.088,.103),rt.add(Lt);let _=new Vt(new hi(.2,24),new pn({visible:!1}));return _.position.z=.11,Y.add(_),{g:Y,spin:rt,hit:_,v:.5,shown:.5,drag:!1}}function G(X,Z){let Y=new ve;Y.position.set(X,Z,0),S.add(Y);let rt=new Vt(new mn(.066,.066,.02,6),E.chrome);rt.rotation.x=Math.PI/2,rt.position.z=.01,rt.castShadow=!0,Y.add(rt);let Et=new Vt(new mn(.036,.036,.035,28),E.satin);Et.rotation.x=Math.PI/2,Et.position.z=.035,Et.castShadow=!0,Y.add(Et);let Dt=new ve;Dt.position.z=.05,Y.add(Dt);let tt=new mn(.024,.016,.21,24);tt.translate(0,.105,0);let _t=new Vt(tt,E.chrome);_t.castShadow=!0,Dt.add(_t);let Lt=new Vt(new Ls(.027,24,16),E.chrome);Lt.position.y=.21,Lt.castShadow=!0,Dt.add(Lt);let _=new Vt(new hi(.11,20),new pn({visible:!1}));return _.position.z=.12,Y.add(_),{g:Y,lever:Dt,hit:_,on:!0,a:Math.PI/3}}function dt(X,Z,Y,rt,Et,Dt){let tt=new ve;tt.position.set(X,Z,0),S.add(tt),x(new Vt(new Zn(Y+.04,rt+.04,.03,3,.012),E.blackAnod),0,0,.012,tt);let _t=C(512,Math.round(512*rt/Y),(L,F,U)=>{let et=L.createLinearGradient(0,0,0,U);et.addColorStop(0,"#ffffff"),et.addColorStop(1,"#dfe6e2"),L.fillStyle=et,L.fillRect(0,0,F,U),L.fillStyle="#0d0f10";let pt=Math.round(U*.3);for(L.font=`600 ${pt}px ${xi}`;L.measureText(Et).width>F*.82&&pt>10;)pt--,L.font=`600 ${pt}px ${xi}`;L.textAlign="center",L.textBaseline="middle",L.fillText(Et,F/2,U/2+2)}),Lt=new di({color:5922659,map:_t.t,emissive:new Wt(Dt),emissiveMap:_t.t,emissiveIntensity:.03,roughness:.28,clearcoat:.6,metalness:0}),_=x(new Vt(new Zn(Y,rt,.045,3,.014),Lt),0,0,.04,tt),D=new Vt(new $e(Y+.04,rt+.04),new pn({visible:!1}));return D.position.z=.08,tt.add(D),{g:tt,cap:_,mat:Lt,hit:D,lit:0,target:0,press:0,glow:Dt}}function ft(X,Z,Y){let rt=new ve;rt.position.set(X,Z,0),S.add(rt);let Et=new Vt(new Ds(.05,.013,16,40),E.chrome);Et.position.z=.01,Et.castShadow=!0,rt.add(Et);let Dt=new di({color:new Wt(Y).multiplyScalar(.35),emissive:new Wt(Y),emissiveIntensity:.06,roughness:.12,clearcoat:1,clearcoatRoughness:.05,metalness:0}),tt=new Vt(new Ls(.044,32,16,0,Math.PI*2,0,Math.PI/2),Dt);tt.rotation.x=Math.PI/2,tt.position.z=.008,rt.add(tt);let _t=new Qi(Y,0,.5,2);return _t.position.z=.06,rt.add(_t),{g:rt,mat:Dt,pl:_t,on:0,target:0,blink:!1}}let Rt=1.3,Ft=.4,Zt=156,$=48,ct=C(Zt*10,$*10,()=>{}),Tt=document.createElement("canvas");Tt.width=2400,Tt.height=$;let lt=Tt.getContext("2d",{willReadFrequently:!0}),Bt=new ye({color:0,emissiveMap:ct.t,emissive:new Wt(16777215),emissiveIntensity:.95,roughness:.6});{let X=new ve;X.position.set(0,.25,0),S.add(X),x(new Vt(new $e(Rt,Ft),Bt),0,0,.004,X,!1),x(b(Rt,Ft,.018,.035,.045,E.blackAnod),0,0,0,X),x(new Vt(new $e(Rt+.02,Ft+.02),E.vfdGlass),0,0,.047,X,!1);let Z=new Qi(5636048,.08,.6,2);Z.position.set(0,0,.12),X.add(Z)}let Ht={a:"",b:""},Gt=-60,te=0,j=!0;function ht(){lt.clearRect(0,0,Tt.width,$),lt.fillStyle="#fff",lt.textBaseline="alphabetic",lt.font="bold 19px Arial, sans-serif",lt.fillText(Ht.a.toUpperCase(),0,21),lt.font="12px Arial, sans-serif",te=Math.ceil(lt.measureText(Ht.b).width)+40,lt.fillText(Ht.b,0,42),j=!0}let w=null,Ut=0;function ot(){j&&(w=lt.getImageData(0,0,Tt.width,$).data,lt.font="bold 19px Arial, sans-serif",Ut=Math.ceil(lt.measureText(Ht.a.toUpperCase()).width),j=!1);let X=ct.ctx,Z=ct.c.width,Y=ct.c.height,rt=10;X.fillStyle="#020a08",X.fillRect(0,0,Z,Y);let Et=te-40>Zt-4,Dt=Math.max(0,Math.floor((Zt-Ut)/2)),tt=Et?Math.max(0,Math.floor(Gt))%te:0,_t=[],Lt=[];for(let _=0;_<$;_++)for(let D=0;D<Zt;D++){let L;if(_<27){let F=D-Dt;L=F>=0&&F<Tt.width&&w[(_*Tt.width+F)*4+3]>110}else{let F=D+tt;Et&&(F%=te),L=F<Tt.width&&w[(_*Tt.width+F)*4+3]>110}(L?_t:Lt).push(D,_)}X.fillStyle="#0b1d18";for(let _=0;_<Lt.length;_+=2)X.fillRect(Lt[_]*rt+2,Lt[_+1]*rt+2,6,6);X.fillStyle="#86ffe0",X.shadowColor="rgba(80,255,210,0.6)",X.shadowBlur=4;for(let _=0;_<_t.length;_+=2)X.fillRect(_t[_]*rt+1.5,_t[_+1]*rt+1.5,7,7);X.shadowBlur=0,ct.t.needsUpdate=!0}let bt=new ve;bt.position.set(-1.95,-.45,0),S.add(bt);{let X=new Vt(new mn(.045,.045,.016,6),E.chrome);X.rotation.x=Math.PI/2,X.position.z=.008,X.castShadow=!0,bt.add(X);let Z=new Vt(new mn(.03,.03,.02,32),E.satin);Z.rotation.x=Math.PI/2,Z.position.z=.02,bt.add(Z);let Y=new Vt(new hi(.018,24),E.hole);Y.position.z=.0305,bt.add(Y)}let ut=new ve;bt.add(ut);{let X=(rt,Et,Dt,tt,_t)=>{let Lt=new Vt(new mn(Et,rt,Dt,32),tt);return Lt.rotation.x=Math.PI/2,Lt.position.z=_t+Dt/2,Lt.castShadow=!0,ut.add(Lt),Lt};X(.022,.022,.02,E.chrome,.03),X(.036,.038,.13,E.rubber,.05),X(.038,.034,.012,E.rubber,.18),X(.03,.017,.07,E.rubber,.192);let Z=new Ts([new P(0,0,.255),new P(0,-.02,.33),new P(.02,-.2,.42),new P(.05,-.6,.44),new P(.08,-1.4,.4)]),Y=new Vt(new Or(Z,80,.016,14,!1),E.rubber);Y.castShadow=!0,ut.add(Y);for(let rt=0;rt<6;rt++){let Et=new Vt(new Ds(.0375,.003,8,32),E.rubber);Et.position.z=.07+rt*.018,ut.add(Et)}}let kt=4096,wt=Math.round(4096*_i/Pn),T=X=>(X+Pn/2)/Pn*kt,v=X=>(_i/2-X)/_i*wt,V=X=>X/Pn*kt,J=C(kt,wt,()=>{});function nt(X){let Z=J.ctx;Z.clearRect(0,0,kt,wt),Z.fillStyle="rgba(236,240,243,0.92)",Z.strokeStyle="rgba(236,240,243,0.85)",Z.textAlign="center",Z.textBaseline="middle";let Y=(Et,Dt,tt,_t,Lt=500,_=.18)=>{Z.font=`${Lt} ${_t}px ${xi}`,"letterSpacing"in Z&&(Z.letterSpacing=`${_t*_}px`),Z.fillText(Et,T(Dt),v(tt))};Y("SOUNDGUARD",0,.66,74,600,.32),Y("SG-1  \xB7  HEADPHONE + MIC PROTECTION",0,.535,30,400,.22),Y("HEADPHONES",-1.31,.66,40,600,.3),Y("MICROPHONE",1.31,.66,40,600,.3),Y("LEVEL",-.79,.59,22,500,.2),Y("LEVEL",.79,.59,22,500,.2),Y("WATCH",-.36,-.165,24),Y("FIX",0,-.165,24),Y("ALERT",.36,-.165,24);for(let Et of[-1,1]){Y("VOLUME",Et*1.5,-.2,24),Y("DRAG",Et*1.5,-.74,18,400,.25);for(let Dt=0;Dt<=10;Dt++){let tt=(135-Dt*27)*Math.PI/180,_t=.215,Lt=Dt%5===0?.25:.237;Z.lineWidth=Dt%5===0?7:5,Z.beginPath(),Z.moveTo(T(Et*1.5+Math.cos(tt+Math.PI/2)*_t),v(-.45+Math.sin(tt+Math.PI/2)*_t)),Z.lineTo(T(Et*1.5+Math.cos(tt+Math.PI/2)*Lt),v(-.45+Math.sin(tt+Math.PI/2)*Lt)),Z.stroke(),(Dt===0||Dt===10)&&Y(String(Dt),Et*1.5+Math.cos(tt+Math.PI/2)*.285,-.45+Math.sin(tt+Math.PI/2)*.285,26,500,0)}Y("ON",Et*1.1,-.27,24),Y("MUTE",Et*1.1,-.64,24)}Y("PHONES",-1.95,-.6,22),Y("POWER",1.95,-.6,22),Z.lineWidth=3,Z.strokeStyle="rgba(236,240,243,0.35)";let rt=(Et,Dt,tt,_t)=>{Z.strokeRect(T(Et),v(_t),T(tt)-T(Et),v(Dt)-v(_t))};rt(-1.98,-.72,-.62,.74),rt(.62,-.72,1.98,.74),J.t.needsUpdate=!0}nt();let K=new Vt(new $e(Pn,_i),new ye({map:J.t,transparent:!0,roughness:.62,metalness:0,depthWrite:!1}));K.position.z=.0012,K.receiveShadow=!0,S.add(K),document.fonts&&document.fonts.ready.then(()=>nt());let Ct={out:W(-1.42,.22,"HEADPHONES"),in:W(1.42,.22,"MICROPHONE")};Ct.out.g.position.x=-1.38,Ct.in.g.position.x=1.38;let yt={out:k(-.8,.22),in:k(.8,.22)},gt={out:at(-1.5,-.45),in:at(1.5,-.45)},$t={out:G(-1.1,-.45),in:G(1.1,-.45)},st={testOut:dt(-.76,-.45,.3,.15,"TEST",8257434),testIn:dt(.76,-.45,.3,.15,"TEST MIC",8257434),fix:dt(0,-.46,.62,.17,"FIX NOW",7208880)},At={watch:ft(-.36,-.08,3014498),fix:ft(0,-.08,16752922),alert:ft(.36,-.08,16720664),power:ft(1.95,-.45,4033535)};At.power.target=1;for(let X of["out","in"])gt[X].spin.rotation.z=(135-.5*270)*Math.PI/180;let zt=new ea(n);zt.addPass(new na(s,r));let qt=new ts(new it(512,256),.5,.35,.86);zt.addPass(qt),zt.addPass(new ia);let xt={x:0,y:0,tx:0,ty:0};function ee(){let X=i.clientWidth||800,Z=i.clientHeight||300;n.setSize(X,Z,!1),zt.setSize(X,Z),qt.setSize(X,Z),r.aspect=X/Z;let Y=Pn*1.07/2/Math.tan(Sl.degToRad(r.fov/2))/r.aspect,rt=_i*1.2/2/Math.tan(Sl.degToRad(r.fov/2));r.userData.dist=Math.max(Y,rt),r.updateProjectionMatrix()}let Kt=new ResizeObserver(ee);Kt.observe(i),ee();let ce=new qr,N=new it,St=()=>[gt.out.hit,gt.in.hit,$t.out.hit,$t.in.hit,st.testOut.hit,st.testIn.hit,st.fix.hit],q=X=>{for(let Z of["out","in"]){if(X===gt[Z].hit)return["knob",Z];if(X===$t[Z].hit)return["toggle",Z]}return X===st.testOut.hit?["button","testOut"]:X===st.testIn.hit?["button","testIn"]:X===st.fix.hit?["button","fix"]:null},Q=X=>{let Z=i.getBoundingClientRect();N.set((X.clientX-Z.left)/Z.width*2-1,-((X.clientY-Z.top)/Z.height)*2+1),ce.setFromCamera(N,r);let Y=ce.intersectObjects(St(),!1)[0];return Y?q(Y.object):null},vt={on:{}},mt=(X,...Z)=>{try{vt.on[X]&&vt.on[X](...Z)}catch(Y){console.error(Y)}},Xt=null,ue=0,Me=0,ne={out:!0,in:!0};i.addEventListener("pointermove",X=>{let Z=i.getBoundingClientRect();if(xt.tx=(X.clientX-Z.left)/Z.width*2-1,xt.ty=(X.clientY-Z.top)/Z.height*2-1,Xt){let rt=gt[Xt],Et=(ue-X.clientY+(X.clientX-Me))/260;ue=X.clientY,Me=X.clientX;let Dt=Math.round(rt.v*20);rt.v=Math.max(0,Math.min(1,rt.v+Et)),Math.round(rt.v*20)!==Dt&&mt("sound","tick"),mt("volume",Xt,rt.v,!1);return}let Y=Q(X);i.style.cursor=Y&&(Y[0]==="button"||ne[Y[1]])?Y[0]==="knob"?"grab":"pointer":"default"}),i.addEventListener("pointerleave",()=>{xt.tx=0,xt.ty=0}),i.addEventListener("pointerdown",X=>{let Z=Q(X);if(Z){if(Z[0]==="knob"&&ne[Z[1]])Xt=Z[1],gt[Z[1]].drag=!0,ue=X.clientY,Me=X.clientX,i.setPointerCapture(X.pointerId),i.style.cursor="grabbing",mt("sound","knob");else if(Z[0]==="toggle"&&ne[Z[1]]){let Y=$t[Z[1]];Y.on=!Y.on,Y.hold=performance.now()+2500,mt("sound",Y.on?"sw_on":"sw_off"),mt("mute",Z[1],!Y.on)}else if(Z[0]==="button"){let Y=st[Z[1]];Y.press=1,mt("sound","btn_down"),setTimeout(()=>{mt("sound","btn_up")},140),mt("press",Z[1])}}});let ze=X=>{if(!Xt)return;let Z=Xt;gt[Z].drag=!1,Xt=null,gt[Z].hold=performance.now()+2500;try{i.releasePointerCapture(X.pointerId)}catch{}mt("volume",Z,gt[Z].v,!0)};i.addEventListener("pointerup",ze),i.addEventListener("pointercancel",ze),i.addEventListener("wheel",X=>{let Z=Q(X);if(!Z||Z[0]!=="knob"||!ne[Z[1]])return;X.preventDefault();let Y=gt[Z[1]];Y.v=Math.max(0,Math.min(1,Y.v+(X.deltaY<0?.02:-.02))),Y.hold=performance.now()+2500,mt("sound","tick"),clearTimeout(Y.wt),Y.wt=setTimeout(()=>mt("volume",Z[1],Y.v,!0),350)},{passive:!1});let de={level:"ok",fixing:!1,auto:!0,micMissing:!1,plugged:!0,needRestart:!1,testOut:!1,testIn:!1,out:0,in:0};vt.setState=X=>{Object.assign(de,X);let Z=X.title||"",Y=X.sub||"";(Z!==Ht.a||Y!==Ht.b)&&(Ht={a:Z,b:Y},Gt=-60,ht());for(let rt of["out","in"]){let Et=X[rt+"Dev"];ne[rt]=!!Et,Et&&(!gt[rt].drag&&!(gt[rt].hold>performance.now())&&(gt[rt].v=Et.volume),$t[rt].hold>performance.now()||($t[rt].on=!Et.muted))}},vt.setLevels=(X,Z)=>{de.out=X,de.in=Z},vt.dispose=()=>{cn=!1,Kt.disconnect(),n.dispose()};let ks=X=>X<=5e-4?0:Math.max(0,Math.min(1,(20*Math.log10(X)+48)/48)),vi=performance.now(),cn=!0,Jn=0;ht();function es(X){if(!cn)return;if(requestAnimationFrame(es),document.hidden){vi=X;return}let Z=Math.min(.05,(X-vi)/1e3);vi=X;let Y=X/1e3;xt.x+=(xt.tx-xt.x)*Math.min(1,Z*3),xt.y+=(xt.ty-xt.y)*Math.min(1,Z*3);let rt=r.userData.dist||6;r.position.set(xt.x*.35,.18-xt.y*.22,rt),r.lookAt(0,0,0);for(let _t of["out","in"]){let Lt=Ct[_t],_=de[_t],D=_>3e-4?20*Math.log10(_)+(_t==="out"?9:12):-40,L=Math.max(-.04,Math.min(1.06,mh(Math.max(-22,Math.min(3.6,D))))),F=170,U=2*Math.sqrt(F)*.62;Lt.v+=(F*(L-Lt.x)-U*Lt.v)*Z,Lt.x+=Lt.v*Z,Lt.pivot.rotation.z=-(Lt.x*2-1)*gh;let et=yt[_t],pt=ks(_);et.lvl=Math.max(pt,et.lvl-Z*1.6),(et.lvl>=et.peak||Y-et.peakT>1.2)&&(et.peak=et.lvl,et.peakT=Y);let It=Math.round(et.lvl*12),Pt=Math.max(0,Math.round(et.peak*12)-1);et.leds.forEach((Yt,Jt)=>{Yt.material.emissiveIntensity=Jt<It||Jt===Pt&&et.peak>.08?1.9:.05})}for(let _t of["out","in"]){let Lt=gt[_t];Lt.shown+=(Lt.v-Lt.shown)*Math.min(1,Z*(Lt.drag?30:8)),Lt.spin.rotation.z=(135-Lt.shown*270)*Math.PI/180;let _=$t[_t],D=_.on?Math.PI/3:2*Math.PI/3;_.a+=(D-_.a)*Math.min(1,Z*22),_.lever.rotation.x=_.a}let Et=Math.sin(Y*9)>0?1:.15,Dt=.55+.45*Math.sin(Y*3.2);st.fix.target=de.level==="bad"||de.level==="warn"?Dt:de.fixing?Et:.12,st.testOut.target=de.testOut?Et:0,st.testIn.target=de.testIn?Et:0;for(let _t of Object.values(st))_t.lit+=(_t.target-_t.lit)*Math.min(1,Z*14),_t.mat.emissiveIntensity=.03+_t.lit*1.05,_t.mat.color.setScalar(.33+_t.lit*.5),_t.press=Math.max(0,_t.press-Z*7),_t.cap.position.z=.04-Math.sin(Math.min(1,_t.press)*Math.PI)*.014;At.watch.target=de.auto?1:0,At.fix.target=de.fixing?Math.sin(Y*8)>0?1:.1:de.level==="warn"?.9:0,At.alert.target=de.needRestart?Math.sin(Y*5)>0?1:.15:de.level==="bad"?1:0;for(let _t of Object.values(At))_t.on+=(_t.target-_t.on)*Math.min(1,Z*16),_t.mat.emissiveIntensity=.06+_t.on*1.35,_t.pl.intensity=_t.on*.06;ut.visible=de.plugged!==!1;let tt=de.micMissing?.035+.025*Math.max(0,Math.sin(Y*2.4)):0;ut.position.z+=(tt-ut.position.z)*Math.min(1,Z*6),Ct.out.faceMat.emissiveIntensity=.3+Math.sin(Y*13.1)*.004,Ct.in.faceMat.emissiveIntensity=.3+Math.sin(Y*11.7+1)*.004,Gt+=Z*26,Jn+=Z,Jn>1/24&&(Jn=0,ot()),zt.render(Z)}return ot(),requestAnimationFrame(es),vt}return Sh(a0);})();
