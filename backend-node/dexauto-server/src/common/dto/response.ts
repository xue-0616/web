export const SUCCESS_MESSAGE = 'success';
export const SUCCESS_CODE = 0;
export function getResponseType(DataClass: any) {
    class Response {
    }
    
    
    
    return Response;
}
export function buildErrorResponse(code: any, message: any) {
    return {
        code,
        message,
        data: undefined,
    };
}
export function buildSuccessResponse(data: any) {
    return {
        code: SUCCESS_CODE,
        data,
        message: SUCCESS_MESSAGE,
    };
}
