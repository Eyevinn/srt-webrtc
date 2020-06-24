const schemaConnection = () => ({
  description: "A connection", 
  type: "object",
  properties: {
    id: { type: "string" },
    localDescription: {
      type: "object",
      properties: {
        type: { type: "string" },
        sdp: { type: "string" }
      }
    },
    remoteDescription: {
      type: "object",
      properties: {
        type: { type: "string" },
        sdp: { type: "string" }
      }
    },
  } 
});

const API_SCHEMA = {
  'GET/connections': {
    description: "Get a list of connections",
    response: {
      200: {
        description: "On success returns an array of connections",
        type: "array",
        items: schemaConnection()
      }
    }
  } 
};    
      
const schemas = (method, path) => {
  return API_SCHEMA[method + path] ? { schema: API_SCHEMA[method + path] } : {};
}   
  
module.exports = schemas;
