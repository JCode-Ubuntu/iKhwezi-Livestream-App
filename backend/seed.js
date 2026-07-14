// Seed test data directly to database
const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

// Initialize database (CORRECT PATH)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'storage', 'ikhwezi.db'),
  logging: false
})

// Define minimal models with EXPLICIT table names and ALL required fields
//
// NOTE: `timestamps: false` used to be set here, diverging from the real
// models in index.js (which use Sequelize's default `timestamps: true` —
// i.e. every table has createdAt/updatedAt). That's a real, latent bug: if
// this script is ever run against a brand-new database *before* the
// backend has started once (so before index.js's own sequelize.sync() has
// created the tables), sequelize.sync() below would create Users/Videos
// permanently missing createdAt/updatedAt — Sequelize's sync() only issues
// CREATE TABLE IF NOT EXISTS, it does not add columns to a table that
// already exists. Every later feature that orders/filters by createdAt
// (feed ordering, comment de-dup windows, the duplicate-username/
// duplicate-interaction cleanup in index.js) would then break at runtime
// against that database. Removed the override so this matches production.
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: true },
  phone: { type: DataTypes.STRING, unique: true, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  displayName: { type: DataTypes.STRING, allowNull: true },
  avatar: { type: DataTypes.STRING, allowNull: true },
  bio: { type: DataTypes.TEXT, allowNull: true },
  isCreator: { type: DataTypes.BOOLEAN, defaultValue: false },
  isBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
  isGuest: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastActive: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { 
  tableName: 'Users',
})

const Video = sequelize.define('Video', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  filename: { type: DataTypes.STRING, allowNull: true },
  thumbnail: { type: DataTypes.STRING, allowNull: true },
  duration: { type: DataTypes.FLOAT, defaultValue: 0 },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
  isSponsored: { type: DataTypes.BOOLEAN, defaultValue: false },
  isTrending: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { 
  tableName: 'Videos',
})

Video.belongsTo(User, { as: 'creator', foreignKey: 'userId' })

// Seed data using raw SQL for reliability
async function seed() {
  try {
    await sequelize.authenticate()
    console.log('✓ Database connected')

    // Create tables if they don't exist
    await sequelize.sync()
    console.log('✓ Tables synchronized')

    // Check if user already exists
    const existingUser = await sequelize.query(
      'SELECT * FROM Users WHERE username = ?',
      { replacements: ['creator'], type: sequelize.QueryTypes.SELECT }
    )

    let userId
    if (existingUser.length === 0) {
      // Insert user using raw SQL
      userId = uuidv4()
      // Previously stored the literal string 'hashed_password' in the
      // password column — not a bcrypt hash at all. bcrypt.compare() never
      // matches a malformed hash, so this seeded account could never
      // actually log in with any password, defeating the purpose of a test
      // account. Hash a real, documented dev password instead.
      const seededPassword = await bcrypt.hash('Password123!', 10)
      const now = new Date()
      // createdAt/updatedAt are NOT NULL on the real Users table (Sequelize
      // enforces its default `timestamps: true` in the DDL) but raw
      // sequelize.query() inserts bypass the ORM's automatic
      // defaultValue/timestamp injection entirely — they have to be
      // supplied explicitly, or this INSERT fails its NOT NULL constraint
      // (confirmed: this previously errored with "Validation error" against
      // the actual seeded database in this repo before this fix).
      await sequelize.query(
        'INSERT INTO Users (id, username, email, password, displayName, avatar, isCreator, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        {
          replacements: [
            userId,
            'creator',
            'creator@ikhwezi.com',
            seededPassword,
            'Creator Vibes',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
            true,
            now,
            now,
          ]
        }
      )
      console.log('✓ Created test user (username: creator, password: Password123!)')
    } else {
      userId = existingUser[0].id
      console.log('✓ User already exists')
    }

    // Create test posts using raw SQL
    const posts = [
      { title: 'Sunset Magic', description: 'Golden hour at the beach, absolutely breathtaking!' },
      { title: 'Mountain Adventure', description: 'Peak hike with an amazing view. Nature is amazing!' },
      { title: 'City Lights', description: 'Nighttime urban vibes in the heart of the city' },
      { title: 'Morning Coffee', description: 'Starting the day right with perfect coffee' },
      { title: 'Going Live!', description: 'Join me for tonight live stream!' }
    ]

    let created = 0
    for (const post of posts) {
      const exists = await sequelize.query(
        'SELECT * FROM Videos WHERE description = ?',
        { replacements: [post.description], type: sequelize.QueryTypes.SELECT }
      )

      if (exists.length === 0) {
        const postId = uuidv4()
        const now = new Date()
        await sequelize.query(
          'INSERT INTO Videos (id, userId, title, description, filename, isPublished, views, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          {
            replacements: [
              postId,
              userId,
              post.title,
              post.description,
              'test-' + post.title.toLowerCase().replace(/[^a-z0-9]/g, '') + '.jpg',
              true,
              Math.floor(Math.random() * 1000),
              now,
              now,
            ]
          }
        )
        created++
        console.log(`  ✓ Created: "${post.title}"`)
      }
    }

    const countResult = await sequelize.query(
      'SELECT COUNT(*) as count FROM Videos',
      { type: sequelize.QueryTypes.SELECT }
    )

    console.log(`\n✓ Seed complete! Created ${created} new test posts`)
    console.log(`✓ Total posts in database: ${countResult[0].count}`)

    process.exit(0)
  } catch (err) {
    console.error('❌ Seed Error:', err.message)
    console.error('Stack:', err.stack)
    process.exit(1)
  }
}

seed()
