import type {NextConfig} from 'next';
const config:NextConfig={
  transpilePackages:['@party-pixels/sdk'],
  async headers(){return [{source:'/games/:game/:path*',headers:[
    // Modules requested by the opaque sandbox origin need CORS. There is no credentialed API here.
    {key:'Access-Control-Allow-Origin',value:'*'},
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Content-Security-Policy',value:"sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"},
  ]}];},
};
export default config;
