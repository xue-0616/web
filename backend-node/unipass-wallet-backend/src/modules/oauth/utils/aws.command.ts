import { AdminCreateUserCommand, AdminGetUserCommand, AdminInitiateAuthCommand, AdminSetUserPasswordCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

export const getAdminCreateUserCommand = (userPoolId: any, username: any, email: any, temporaryPassword: any) => {
    const command = new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: [
            {
                Name: 'email',
                Value: email,
            },
        ],
        ForceAliasCreation: true,
        MessageAction: 'SUPPRESS',
        TemporaryPassword: temporaryPassword,
    });
    return command;
};
export const getAdminSetUserPasswordCommand = (userPoolId: any, username: any, password: any) => {
    const command = new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: username,
        Permanent: true,
        Password: password,
    });
    return command;
};
export const getAdminInitiateAuthCommand = (clientId: any, userPoolId: any, username: any, password: any, secret: any) => {
    const secretHash = createHmac('SHA256', secret)
        .update(`${username}${clientId}`)
        .digest('base64');
    const command = new AdminInitiateAuthCommand({
        ClientId: clientId,
        UserPoolId: userPoolId,
        AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
            SECRET_HASH: secretHash,
        },
    });
    return command;
};
export const getAdminGetUserCommand = (userPoolId: any, username: any) => {
    const command = new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username,
    });
    return command;
};
