import { DataTypes, Model, Sequelize } from "sequelize";

//Document Model
export class Document extends Model { }

export const DocumentInit = async (sequelize: Sequelize) => {
    Document.init({
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        page_id: {
            type: DataTypes.TEXT,
            unique: true,
        },
        heading: {
            type: DataTypes.TEXT
        },
        checksum: {
            type: DataTypes.TEXT
        },
        path: {
            type: DataTypes.TEXT
        },
        meta: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'document'
    });

    await Document.sync({
        // force: true
    });
}


//DocumentPage Model
export class DocumentPage extends Model { }

export const DocumentPageInit = async (sequelize: Sequelize) => {
    DocumentPage.init({
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        page_id: {
            type: DataTypes.TEXT
        },
        content: {
            type: DataTypes.TEXT
        },
        heading: {
            type: DataTypes.TEXT
        },
        embedding: {
            //@ts-ignore
            type: DataTypes.VECTOR(1536)
        },
        token_count: {
            type: DataTypes.INTEGER
        }
    }, {
        sequelize,
        modelName: 'document_page'
    });

    await DocumentPage.sync({
        // force: true
    });
}

// export const createDocumentPageSelectionFunc = (sequelize: Sequelize) => {
//     sequelize.query(`create or replace function match_page_sections(embedding vector(1536), match_threshold float, match_count int)
//     returns table (page_id text,content text)
//     language plpgsql
//     as $$
//     #variable_conflict use_variable
//     begin
//       return query
//       select
//         document_pages.page_id,
//         document_pages.content
//       from document_pages
    
//       -- We only care about sections that have a useful amount of content
//       where (document_pages.embedding <#> embedding) * -1 > match_threshold
    
//       order by document_pages.embedding <#> embedding
      
//       limit match_count;
//     end;
//     $$;`)
// }