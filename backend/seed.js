// Seed test data directly to database
const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')

// Initialize database (CORRECT PATH)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'storage', 'ikhwezi.db'),
  logging: false
})

// Define minimal models with EXPLICIT table names
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: true },
  displayName: DataTypes.STRING,
  avatar: DataTypes.STRING,
  password: { type: DataTypes.STRING, allowNull: false }
}, { 
  tableName: 'Users',
  timestamps: false // Don't need timestamps for seeding
})

const Video = sequelize.define('Video', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  filename: DataTypes.STRING,
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { 
  tableName: 'Videos',
  timestamps: false
})

Video.belongsTo(User, { as: 'creator', foreignKey: 'userId' })

// Seed data
async function seed() {
  try {
    await sequelize.authenticate()
    console.log('✓ Database connected')

    // Tables already exist from backend startup, no need to sync again
    console.log('✓ Database tables already initialized')

    // Create test user
    let user = await User.findOne({ where: { username: 'creator' } })
    if (!user) {
      user = await User.create({
        username: 'creator',
        email: 'creator@ikhwezi.com',
        displayName: 'Creator Vibes 🎬',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
        password: 'hashed_password_here'
      })
      console.log('✓ Created test user:', user.username)
    } else {
      console.log('✓ User already exists:', user.username)
    }

    // Create test posts
    const posts = [
      { title: 'Sunset Magic', description: 'Golden hour at the beach, absolutely breathtaking! 🌅' },
      { title: 'Mountain Adventure', description: 'Peak hike with an amazing view. Nature is amazing! ⛰️' },
      { title: 'City Lights', description: 'Nighttime urban vibes in the heart of the city 🌃' },
      { title: 'Morning Coffee', description: 'Starting the day right with perfect coffee ☕' },
      { title: 'Going Live!', description: 'Join me for tonight live stream! 🔴' }
    ]

    let created = 0
    for (const post of posts) {
      const exists = await Video.findOne({ where: { description: post.description } })
      if (!exists) {
        await Video.create({
          userId: user.id,
          title: post.title,
          description: post.description,
          filename: 'test-' + post.title.toLowerCase().replace(/[^a-z0-9]/g, '') + '.jpg',
          isPublished: true
        })
        created++
        console.log(`  ✓ Created: "${post.title}"`)
      }
    }

    console.log(`\n✓ Seed complete! Created ${created} new test posts`)
    const count = await Video.count()
    console.log(`✓ Total posts in database: ${count}`)

    process.exit(0)
  } catch (err) {
    console.error('❌ Seed Error:', err.message)
    console.error('Stack:', err.stack)
    process.exit(1)
  }
}

seed()
