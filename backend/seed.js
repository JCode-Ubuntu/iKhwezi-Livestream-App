// Seed test data directly to database
const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const { v4: uuidv4 } = require('uuid')

// Initialize database (CORRECT PATH)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'storage', 'ikhwezi.db'),
  logging: false
})

// Define minimal models with EXPLICIT table names and ALL required fields
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
  timestamps: false
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
  timestamps: false
})

Video.belongsTo(User, { as: 'creator', foreignKey: 'userId' })

// Seed data using raw SQL for reliability
async function seed() {
  try {
    await sequelize.authenticate()
    console.log('✓ Database connected')

    // Check if user already exists
    const existingUser = await sequelize.query(
      'SELECT * FROM Users WHERE username = ?',
      { replacements: ['creator'], type: sequelize.QueryTypes.SELECT }
    )

    let userId
    if (existingUser.length === 0) {
      // Insert user using raw SQL
      const { v4: uuidv4 } = require('uuid')
      userId = uuidv4()
      await sequelize.query(
        'INSERT INTO Users (id, username, email, password, displayName, avatar, isCreator) VALUES (?, ?, ?, ?, ?, ?, ?)',
        {
          replacements: [
            userId,
            'creator',
            'creator@ikhwezi.com',
            'hashed_password',
            'Creator Vibes',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
            true
          ]
        }
      )
      console.log('✓ Created test user')
    } else {
      userId = existingUser[0].id
      console.log('✓ User already exists')
    }

    // Create test posts using raw SQL
    const { v4: uuidv4 } = require('uuid')
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
        await sequelize.query(
          'INSERT INTO Videos (id, userId, title, description, filename, isPublished, views) VALUES (?, ?, ?, ?, ?, ?, ?)',
          {
            replacements: [
              postId,
              userId,
              post.title,
              post.description,
              'test-' + post.title.toLowerCase().replace(/[^a-z0-9]/g, '') + '.jpg',
              true,
              Math.floor(Math.random() * 1000)
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
