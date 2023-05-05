import * as pg from 'pg';
import { Sequelize } from 'sequelize';
const pgvector = require('pgvector/sequelize');

export const connect = async (): Promise<Sequelize> => {

    await pgvector.registerType(Sequelize);

    let sequelize = dbInstance();

    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector');

    //Need to close and reopen
    sequelize.close();
    
    sequelize = dbInstance()

    return sequelize
}

const dbInstance = () => {
    return new Sequelize(`postgres://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DATABASE}`, {
        logging: false,
        dialectModule: pg
    })
}