pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Environment') {
            steps {
                sh '''
                    node -v
                    npm -v
                    git --version
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        npm install
                    fi
                '''
            }
        }

        stage('Prisma Generate') {
            steps {
                withEnv(["DATABASE_URL=mysql://dummy:dummy@localhost:3306/dummy"]) {
                    sh '''
                        if [ -f prisma/schema.prisma ]; then
                            npx prisma generate
                        else
                            echo "No Prisma schema found, skipping."
                        fi
                    '''
                }
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint --if-present || true'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run test --if-present'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }

    post {
        success {
            echo 'Backend CI succeeded.'
        }

        failure {
            echo 'Backend CI failed. Please check the Console Output.'
        }

        always {
            deleteDir()
        }
    }
}