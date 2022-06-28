import config from 'config';
import fetch from 'node-fetch';
import fs from 'node:fs/promises';
import http from 'node:http';
import moment from 'moment';
import { parseString } from 'xml2js';
import winston from 'winston';


// This module is heavily based on the reverse-engineering found at:
// <https://gist.github.com/DexterHaslem/d0365dd4cbbcceac22a002fa981beaae>


const STATUSES = {
    OK: 200,
    REDIRECT: 302
}

const httpAgent = new http.Agent( {
    keepAlive: true
} );


const logger = winston.createLogger( {
    level: config.get( 'log.level' ),
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File( {
            filename: config.get( 'log.fileName' ),
            timestamp: true
        } )
    ],
} );


if ( process.env.NODE_ENV !== 'production' ) {
    logger.add( new winston.transports.Console( {
        format: winston.format.simple(),
        timestamp: true
    } ) );
}


main();


async function main() {
    try {
        saveLogs( await getLogs( await getSessionId() ) );
    } catch ( error ) {
        logger.error( error );
    }
}


async function getSessionId() {
    const loginResponse = await login( await getWebToken() );

    if ( loginResponse.status == STATUSES.REDIRECT ) {
        const response = await fetch( getUrl( 'index' ), {
            method: 'GET',
            insecureHTTPParser: true,
            agent: httpAgent
        } );

        const sessionId = getCookieValue( response.headers.raw(), config.get( 'sessionIdCookieName' ) );

        logger.debug( 'sessionId = %s', sessionId );

        if ( sessionId != null ) {
            return sessionId;
        } else {
            throw 'Invalid session ID.';
        }
    } else {
        throw 'Invalid response from login form.';
    }
}


async function getWebToken() {
    const response = await fetch( getUrl( 'loginForm' ), {
        method: 'GET',
        insecureHTTPParser: true,
        agent: httpAgent
    } );

    const webToken = extractValue( config.get( 'webTokenRegEx' ), await response.text() );

    logger.debug( 'webToken = %s', webToken );

    if ( webToken != null ) {
        return webToken;
    } else {
        throw 'Error obtaining web token.';
    }
}


function login( webToken ) {
    const params = new URLSearchParams();

    params.append( 'loginUsername', config.get( 'modem.user' ) );
    params.append( 'loginPassword', config.get( 'modem.password' ) );
    params.append( 'login', 1 );
    params.append( 'webToken', webToken );

    return fetch( getUrl( 'formTarget' ), {
        method: 'POST',
        body: params,
        insecureHTTPParser: true,
        agent: httpAgent,
        redirect: 'manual',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    } );
}


function getUrl( endpoint ) {
    return [ config.get( 'modem.address' ), config.get( 'endpoints.' + endpoint ) ].join( '' );
}


function getCookieValue( headers, cookieName ) {
    let cookieValue = null;

    const cookieHeaders = headers[ 'set-cookie' ] || [];

    cookieHeaders.forEach( cookie => {
        let cookieDetails = cookie.split( '=' );

        if ( cookieDetails.length == 2 && cookieDetails[ 0 ] === cookieName ) {
            cookieValue = cookieDetails[ 1 ];

            return;
        }
    } );

    return cookieValue;
}


function extractValue( pattern, data ) {
    let value = null;

    const regExp = new RegExp( pattern );

    if ( regExp.test( data ) ) {
        value = data.match( regExp )[ 1 ];
    }

    return value;
}


async function getLogs( sessionId ) {
    let events = null;

    const logsResponse = await fetch( getUrl( 'eventLog' ), {
        method: 'GET',
        insecureHTTPParser: true,
        agent: httpAgent,
        headers: {
            Cookie: [ config.get( 'sessionIdCookieName' ), sessionId ].join( '=' )
        }
    } );

    const logsXml = extractValue( config.get( 'xmlFormatRegEx' ), await logsResponse.text() );

    parseString( logsXml, ( error, result ) => {
        if ( error == null ) {
            const fields = config.get( 'events.fields' );

            events = result[ config.get( 'events.rootElement' ) ][ config.get( 'events.rowElement' ) ]
                .map( event => {
                    fields.forEach( field => {
                        if ( field.exclude ) {
                            delete event[ field.element ];
                        } else {
                            switch ( field.type ) {
                                case 'number':
                                    event[ field.element ] = Number( event[ field.element ] );
                                    break;

                                case 'string':
                                    if ( Array.isArray( event[ field.element ] ) ) {
                                        event[ field.element ] = event[ field.element ].join( '' );
                                    }
                                    break;

                                case 'time':
                                    event[ field.element ] = new Date( Date.parse( String( event[ field.element ] ).replace( ', ', 'T' ) ) ).toISOString();
                                    break;
                            }
                        }
                    } );

                    return event;
                } );
        } else {
            throw error;
        }
    } );

    return events;
}


function saveLogs( logEntries ) {
    let content = null;

    switch ( config.get( 'output.format' ) ) {
        case 'csv':
            let fields = config.get( 'events.fields' ).filter( field => {
                return !!!field.exclude;
            } );

            content = fields.map( field => {
                return field.header;
            } ).join( ',' ) + '\n';

            content += logEntries.map( event => {
                let values = [];

                fields.forEach( field => {
                    let value = event[ field.element ];

                    if ( String( value ).indexOf( ',' ) != -1 ) {
                        value = [
                            '"',
                            String( value ).replace( /"/g, '\\"' ),
                            '"'
                        ].join( '' );
                    }

                    values.push( value );
                } );

                return values.join( ',' );
            } ).join( '\n' );
            break;

        case 'json':
            content = JSON.stringify( logEntries );
            break;
    }

    fs.writeFile( getLogFileName(), content );
}


function getLogFileName() {
    return [
        config.get( 'output.basePath' ),
        '/',
        moment().format( config.get( 'output.fileNamePattern' ) )
    ].join( '' );
}