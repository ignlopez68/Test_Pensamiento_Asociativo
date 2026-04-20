import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('database.sqlite');
const query = `
WITH UserStats AS (
    SELECT 
        u.id as user_id, 
        u.email,
        u.nia as nia,
        COUNT(r.id) as fluidez,
        COUNT(DISTINCT a.category) as flexibilidad,
        (SELECT SUM(LENGTH(r2.response_text) - LENGTH(REPLACE(r2.response_text, ' ', '')) + 1)
         FROM test_responses r2 
         WHERE r2.user_id = u.id) as total_words
    FROM users u
    LEFT JOIN test_responses r ON u.id = r.user_id
    LEFT JOIN response_analysis a ON r.id = a.response_id
    GROUP BY u.id
),
HistoricalUniqueCategories AS (
    SELECT a.category 
    FROM test_responses r 
    JOIN response_analysis a ON r.id = a.response_id
    WHERE a.category IS NOT NULL
    GROUP BY a.category 
    HAVING count(DISTINCT r.user_id) = 1
),
UserOriginalidad AS (
    SELECT 
        r.user_id, 
        COUNT(r.id) as originalidad
    FROM test_responses r
    JOIN response_analysis a ON r.id = a.response_id
    WHERE a.category IN (SELECT category FROM HistoricalUniqueCategories)
    GROUP BY r.user_id
)
SELECT 
    us.user_id,
    us.email,
    us.nia,
    us.fluidez,
    us.flexibilidad,
    IFNULL(uo.originalidad, 0) as originalidad,
    CASE WHEN us.fluidez > 0 THEN CAST(us.total_words AS FLOAT) / us.fluidez ELSE 0 END as elaboracion
FROM UserStats us
LEFT JOIN UserOriginalidad uo ON us.user_id = uo.user_id
ORDER BY us.fluidez DESC
LIMIT 5;
`;

db.all(query, [], (err, rows) => {
    if (err) console.error(err);
    console.log(rows);
});
