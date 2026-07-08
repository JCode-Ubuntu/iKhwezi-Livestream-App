// Seed test data directly to database
const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')

// Initialize database (CORRECT PATH)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'storage', 'ikhwezi.db'),
  logging: false
})

// Define minimal models
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: true },
  displayName: DataTypes.STRING,
  avatar: DataTypes.STRING,
  password: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: true, tableName: 'Users' })

const Video = sequelize.define('Video', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  filename: DataTypes.STRING,
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true, tableName: 'Videos' })

Video.belongsTo(User, { as: 'creator', foreignKey: 'userId' })

// Seed data
async function seed() {
  try {
    await sequelize.authenticate()
    console.log('✓ Database connected')

    // SYNC TABLES FIRST!
    await sequelize.sync()
    console.log('✓ Database tables synchronized')

    // Create test user
    let user = await User.findOne({ where: { username: 'creator' } })
    if (!user) {
      user = await User.create({
        username: 'creator',
        email: 'creator@ikhwezi.com',
        displayName: 'Test Creator',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
        password: 'hashed_password_here'
      })
      console.log('✓ Created test user')
    }

    // Create test posts
    const posts = [
      { title: 'Sunset', description: 'Golden sunset at the beach' },
      { title: 'Mountains', description: 'Amazing mountain peak adventure' },
      { title: 'City', description: 'Urban lights and night vibes' },
      { title: 'Coffee', description: 'Morning coffee and good energy' },
      { title: 'Stream', description: 'Live streaming the future' }
    ]

    let created = 0
    for (const post of posts) {
      const exists = await Video.findOne({ where: { description: post.description } })
      if (!exists) {
        await Video.create({
          userId: user.id,
          title: post.title,
          description: post.description,
          filename: 'test-' + post.title.toLowerCase() + '.jpg',
          isPublished: true
        })
        created++
      }
    }

    console.log(`✓ Created ${created} test posts`)
    const count = await Video.count()
    console.log(`✓ Total posts in database: ${count}`)

    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

seed()
