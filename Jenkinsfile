pipeline {
    agent any

    environment {
        REGISTRY   = "docker.io"                              // Docker Hub registry mặc định
        IMAGE_NAME = "nguyentt07/certificate-app-backend"          // đổi username nếu cần
        TAG        = "dev-${env.BUILD_NUMBER}"                 // Tag image theo số build
    }

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

        stage('Build & Push Image to Registry') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {

                    sh """
                    docker login ${REGISTRY} -u "$REG_USER" -p "$REG_PASS"
                    docker build -t ${IMAGE_NAME}:${TAG} .
                    docker push ${IMAGE_NAME}:${TAG}
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ Backend CI succeeded: ${IMAGE_NAME}:${TAG}"
        }

        failure {
            echo 'Backend CI failed. Please check the Console Output.'
        }

        always {
            deleteDir()
        }
    }
}