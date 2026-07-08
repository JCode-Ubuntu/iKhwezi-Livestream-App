// Seed test data directly to database
const { Sequelize } = require('sequelize')
const path = require('path')

// Initialize database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'storage', 'database.sqlite'),
  logging: false
})

// Define minimal models
const User = sequelize.define('User', {
  username: Sequelize.STRING,
  email: Sequelize.STRING,
  displayName: Sequelize.STRING,
  avatar: Sequelize.STRING
}, { timestamps: true, tableName: 'Users' })

const Video = sequelize.define('Video', {
  userId: Sequelize.INTEGER,
  title: Sequelize.STRING,
  description: Sequelize.STRING,
  filename: Sequelize.STRING,
  isPublished: { type: Sequelize.BOOLEAN, defaultValue: true }
}, { timestamps: true, tableName: 'Videos' })

Video.belongsTo(User, { as: 'creator', foreignKey: 'userId' })

// Seed data
async function seed() {
  try {
    await sequelize.authenticate()
    console.log('✓ Database connected')

    // Create test user
    let user = await User.findOne({ where: { username: 'creator' } })
    if (!user) {
      user = await User.create({
        username: 'creator',
        email: 'creator@ikhwezi.com',
        displayName: 'Test Creator',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator'
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
